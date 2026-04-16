/**
 * BOSS 챗봇 LangChain AgentExecutor 설정
 *
 * createReactAgent(llm, tools) 로 에이전트 생성.
 * route.ts의 수동 루프 대신 LangGraph가 루프를 자동 처리.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { BOSS_AGENT_TOOLS } from "./tools";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";

// ── LLM 초기화 ───────────────────────────────────────────────────────────────
function createLLM() {
  return new ChatAnthropic({
    apiKey: ANTHROPIC_KEY,
    model: MODEL,
    maxTokens: 1500,
  });
}

// ── 에이전트 실행 (스트리밍) ─────────────────────────────────────────────────
export interface RunAgentOptions {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  systemPrompt: string;
}

export async function runBossAgent(options: RunAgentOptions): Promise<ReadableStream> {
  const { message, history, systemPrompt } = options;

  const llm = createLLM();
  const agent = createReactAgent({
    llm,
    tools: BOSS_AGENT_TOOLS,
    messageModifier: systemPrompt,
  });

  // 대화 히스토리 → LangChain 메시지 변환
  const langchainHistory = history.slice(-30).map((m) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
  );

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await agent.stream(
          { messages: [...langchainHistory, new HumanMessage(message)] },
          { streamMode: "values" }
        );

        let lastText = "";

        for await (const chunk of stream) {
          const messages = chunk.messages as Array<{ _getType?: () => string; content?: unknown }>;
          const lastMsg = messages[messages.length - 1];

          // AI 최종 텍스트 응답만 스트리밍
          if (lastMsg && lastMsg._getType?.() === "ai") {
            const content = lastMsg.content;
            const text = typeof content === "string" ? content : "";

            if (text && text !== lastText) {
              // 새로 추가된 부분만 전송
              const delta = text.slice(lastText.length);
              if (delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`)
                );
              }
              lastText = text;
            }
          }
        }
      } catch (err) {
        const errMsg = `죄송합니다, 처리 중 오류가 발생했습니다: ${String(err)}`;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: errMsg })}\n\n`)
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return readable;
}

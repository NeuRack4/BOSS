/**
 * BOSS 에이전틱 챗봇 API Route — v2 (LangChain)
 *
 * POST /api/chat-v2
 *
 * 기존 /api/chat (raw fetch 루프) 와 동일한 동작을 LangChain AgentExecutor로 구현.
 * - createReactAgent가 도구 선택 → 실행 → 최종 답변 루프를 자동 처리
 * - 기존 /api/chat 는 그대로 보존 (비교 테스트용)
 *
 * ⚠️ 신규 파일 — 기존 소스 미수정
 */

import { NextRequest } from "next/server";
import { runBossAgent } from "@/lib/chatbot/agent";

const SYSTEM_PROMPT = `당신은 BOSS의 카페 창업 전담 AI 비서입니다.
서울 마포구에서 카페를 창업하거나 운영 중인 사장님 옆에서 실질적인 문제를 해결해주는 역할입니다.

## 핵심 역할 정의

당신은 단순히 정보를 알려주는 챗봇이 아닙니다.
**사장님의 상황을 파악하고 → 전문 지식을 근거로 판단하고 → 사장님이 지금 당장 해야 할 행동을 제시하는 AI**입니다.

모든 대화의 끝은 반드시 다음 중 하나로 마무리해야 합니다:
1. **사장님이 다음에 해야 할 구체적인 행동 1~3가지** (번호 목록으로)
2. 또는 **BOSS 서비스에서 직접 처리할 수 있는 메뉴 안내**

## 도구 사용 기준

- 사업자등록, 식품위생신고, 인허가 → search_laws 필수 호출
- 근로계약, 임대차 계약 → search_laws 필수 호출
- 지원사업, 보조금 → search_subsidies + get_ongoing_subsidies 호출
- 세금 신고 기한 → get_tax_deadlines 필수 호출 (기억으로 날짜 답변 금지)
- 마포구 상권, 입지 → get_location_districts 호출

## 면책 고지
세금·법률·계약 관련 답변 말미에 반드시 포함:
"※ 본 내용은 참고용이며 실제 신고·계약 전 전문가 확인을 권장합니다."`;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  userId?: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "잘못된 요청 형식입니다." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { message, history = [] } = body;
  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: "메시지를 입력해주세요." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = await runBossAgent({
    message,
    history,
    systemPrompt: SYSTEM_PROMPT,
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

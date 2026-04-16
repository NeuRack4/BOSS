/**
 * BOSS 에이전틱 챗봇 API Route
 *
 * POST /api/chat
 *
 * Claude Tool Use 기반 에이전틱 루프 (raw fetch — SDK 불필요):
 *   1차 호출 — Claude가 질문 분석 후 필요한 도구 자동 선택 (논스트리밍)
 *   도구 실행 — 팀원이 만든 BOSS API를 병렬 호출 (소스 수정 없음)
 *   2차 호출 — 도구 결과 포함, 최종 답변 SSE 스트리밍
 *
 * ⚠️ 신규 파일 — 기존 소스 미수정
 * ⚠️ 팀원 API는 읽기 조회만 — 데이터 변경 없음
 */

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ── 파일 로그 (logs/chatbot.log) ─────────────────────────────────────────────
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "chatbot.log");

function writeLog(line: string) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const entry = `[${ts}] ${line}\n`;
  console.log(line); // 터미널 동시 출력
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, entry, "utf8");
  } catch (e) {
    console.error("[CHATBOT] 로그 파일 쓰기 실패:", e);
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_VERSION = "2023-06-01";
// 테스트: CLAUDE_MODEL=claude-haiku-4-5 (약 25배 저렴)
const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

// ── 시스템 프롬프트 ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 BOSS의 카페 창업 전담 AI 비서입니다.
서울 마포구에서 카페를 창업하거나 운영 중인 사장님 옆에서 실질적인 문제를 해결해주는 역할입니다.

## 핵심 역할 정의

당신은 단순히 정보를 알려주는 챗봇이 아닙니다.
**사장님의 상황을 파악하고 → 전문 지식을 근거로 판단하고 → 사장님이 지금 당장 해야 할 행동을 제시하는 AI**입니다.

모든 대화의 끝은 반드시 다음 중 하나로 마무리해야 합니다:
1. **사장님이 다음에 해야 할 구체적인 행동 1~3가지** (번호 목록으로)
2. 또는 **BOSS 서비스에서 직접 처리할 수 있는 메뉴 안내** (서류 초안, 지원사업, 세금 등)

"정보를 드렸으니 알아서 하세요"는 절대 금지입니다.

## 도구 사용 — 반드시 지켜야 할 규칙

**법령·절차·신고 관련 질문은 항상 search_laws를 먼저 호출합니다.**
당신의 훈련 데이터가 아닌, Supabase에 임베딩된 실제 법령 원문을 근거로 답변해야 합니다.
이것이 일반 챗봇과 당신의 가장 큰 차이입니다.

도구 사용 기준:
- 사업자등록, 식품위생신고, 인허가 → search_laws("사업자등록 절차") 필수 호출
- 근로계약, 임대차 계약 → search_laws("근로계약 최저임금"), search_laws("임대차 확정일자") 필수 호출
- 지원사업, 보조금 → search_subsidies + get_ongoing_subsidies 호출
- 세금 신고 기한 → get_tax_deadlines 필수 호출 (기억으로 날짜 답변 금지)
- 마포구 상권, 입지 → get_location_districts 호출
- 두 가지 이상 복합 질문 → 병렬로 여러 도구 동시 호출

도구 없이 답변해도 되는 경우:
- 창업 절차 흐름에 대한 매우 일반적인 설명 (예: "카페 창업 순서를 대략 알려줘")
- 최저임금·주휴수당 계산 등 단순 수치 계산

## 답변 구조 (항상 이 순서로)

1. **상황 파악** — 사장님이 어떤 단계인지, 무엇이 필요한지 한 줄로 확인
2. **전문가 판단** — 도구로 가져온 법령·데이터 근거를 명시하며 핵심 내용 설명
3. **다음 행동 안내** — 사장님이 지금 당장 해야 할 행동 1~3가지 번호 목록

예시:
> 사장님, 식품위생 영업신고를 아직 안 하셨군요.
> 식품위생법 제37조에 따르면 영업 시작 전 관할 구청에 신고를 완료해야 합니다.
>
> **지금 바로 해야 할 행동:**
> 1. BOSS [서류 초안] 메뉴에서 식품영업 신고서 자동 작성 → /drafts/food-business-license
> 2. 마포구청 위생과 방문 예약 (☎ 02-3153-9000)
> 3. 시설 기준 체크리스트 사전 확인

## BOSS 서비스 전체 범위

| 영역 | 메뉴 경로 | 도구 |
|------|-----------|------|
| 사업자등록 신청서 | /drafts/business-registration | search_laws |
| 식품위생 신고서 | /drafts/food-business-license | search_laws |
| 근로계약서 | /drafts/employment-contract | search_laws |
| 임대차계약서 | /drafts/lease-contract | search_laws |
| 지원사업 매칭 | /dashboard/subsidies | search_subsidies |
| 세금 기한·신고 | /dashboard/tax | get_tax_deadlines |
| 법령 검색 | /dashboard/rag | search_laws |
| 입지 분석 | /location | get_location_districts |
| 매출 관리 | /dashboard/sales | — |
| AI 인사이트 | /dashboard/insights | — |

## 절대 하지 말아야 할 것

- 도구 없이 법령 조항이나 세금 기한을 기억으로 말하기 (반드시 도구로 확인)
- 챗봇에서 PDF 직접 생성 (서류 초안 메뉴로 안내만)
- "전문가에게 문의하세요"로만 마무리하기 (안내 + 다음 행동 필수)
- 정보만 나열하고 행동 지침 없이 끝내기

## 면책 고지
세금·법률·계약 관련 답변 말미에 반드시 포함:
"※ 본 내용은 참고용이며 실제 신고·계약 전 전문가 확인을 권장합니다."`;

// ── Tool 정의 (Anthropic Tool Use 스펙) ──────────────────────────────────────
const BOSS_TOOLS = [
  {
    name: "search_laws",
    description:
      "Supabase에 임베딩된 실제 법령·규정·절차 원문을 검색합니다. " +
      "사업자등록, 식품위생법, 근로기준법, 상가임대차보호법, 부가가치세법 등 " +
      "카페 창업·운영 관련 모든 법령이 포함됩니다. " +
      "절차·신고·법령·계약 관련 질문에는 반드시 이 도구를 먼저 호출하세요. " +
      "기억(training data)으로 답변하면 안 됩니다 — 반드시 이 도구로 실제 법령 원문을 확인하세요.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색 키워드 (예: '식품위생법 영업신고', '근로계약 최저임금')",
        },
        category: {
          type: "string",
          enum: ["license", "tax", "labor", "lease", "subsidy", "regulation"],
          description:
            "카테고리 필터(선택): license=인허가, tax=세금, labor=노동, lease=임대차, subsidy=지원, regulation=규제",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_subsidies",
    description:
      "창업자가 신청 가능한 지원사업·보조금을 검색합니다. " +
      "기업마당 공고 기반으로 자금지원, 교육, 컨설팅, 임차료 지원 등을 검색합니다.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색 키워드 (예: '카페 창업 자금', '소상공인 임차료 지원')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_tax_deadlines",
    description:
      "다가오는 세금 신고·납부 기한을 실시간으로 조회합니다. " +
      "부가가치세, 종합소득세, 원천세 기한을 현재 날짜 기준으로 가져옵니다.",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: {
          type: "number",
          description: "조회 기간 (일 수, 기본 90일)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_ongoing_subsidies",
    description:
      "현재 상시 모집 중인 지원사업 목록을 조회합니다. " +
      "연중 신청 가능한 지원사업을 확인할 때 사용합니다.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_location_districts",
    description:
      "마포구 카페 창업 가능 상권 목록과 정보를 조회합니다. " +
      "홍대입구, 합정, 연남동, 망원동, 공덕, 성산동 등 상권별 특성을 제공합니다.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ── 도구 실행 (팀원 API 호출 — 소스 수정 없음) ───────────────────────────────
async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "search_laws": {
        const res = await fetch(`${API_BASE}/rag/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: input.query,
            match_count: 5,
            ...(input.category ? { category: input.category } : {}),
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return `[법령 검색 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as Array<{
          content: string;
          metadata: Record<string, unknown>;
        }>;
        if (!data.length) return "[법령 검색 결과 없음] 관련 법령을 찾지 못했습니다.";
        return data.slice(0, 5).map((r, i) => {
          const source = r.metadata?.source ?? "출처 미상";
          const article = r.metadata?.article ? ` ${r.metadata.article}` : "";
          return `【법령 ${i + 1}】${source}${article}\n${r.content.slice(0, 500)}`;
        }).join("\n\n");
      }

      case "search_subsidies": {
        const res = await fetch(`${API_BASE}/subsidies/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: input.query, match_count: 5 }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return `[지원사업 검색 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!data.length) return "[지원사업 검색 결과 없음] 관련 지원사업을 찾지 못했습니다.";
        return data.slice(0, 5).map((r, i) => {
          const deadline = r.end_date ? `마감: ${r.end_date}` : r.is_ongoing ? "상시 모집" : "마감일 미정";
          const target = r.target ? `대상: ${r.target}` : "";
          return `【지원사업 ${i + 1}】${r.title} (${r.organization})\n${deadline}${target ? " | " + target : ""}\n${String(r.description ?? "").slice(0, 250)}`;
        }).join("\n\n");
      }

      case "get_tax_deadlines": {
        const days = (input.days_ahead as number) ?? 90;
        const res = await fetch(`${API_BASE}/tax/deadlines?days_ahead=${days}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return `[세금 기한 조회 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as {
          deadlines: Array<Record<string, unknown>>;
        };
        const deadlines = data.deadlines ?? [];
        if (!deadlines.length) return "[세금 신고 기한 없음] 해당 기간 내 예정된 세금 신고가 없습니다.";
        return "【세금 신고 기한 목록】\n" + deadlines.slice(0, 10).map((d) =>
          `- ${d.deadline_date} | ${d.title} (${d.tax_type})\n  ${String(d.description ?? "").slice(0, 150)}`
        ).join("\n");
      }

      case "get_ongoing_subsidies": {
        const res = await fetch(`${API_BASE}/subsidies/ongoing`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return `[상시 지원사업 조회 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!data.length) return "[상시 지원사업 없음] 현재 상시 모집 중인 지원사업이 없습니다.";
        return "【상시 모집 지원사업】\n" + data.slice(0, 8).map((r, i) => {
          const target = r.target ? ` | 대상: ${r.target}` : "";
          return `${i + 1}. ${r.title} (${r.organization})${target}\n   ${String(r.description ?? "").slice(0, 200)}`;
        }).join("\n\n");
      }

      case "get_location_districts": {
        const res = await fetch(`${API_BASE}/location/districts`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return `[상권 정보 조회 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!data || (Array.isArray(data) && !data.length)) return "[상권 정보 없음] 상권 데이터를 불러오지 못했습니다.";
        if (Array.isArray(data)) {
          return "【마포구 9개 상권 정보】\n" + data.map((d) => {
            const name = d.name ?? d.district_name ?? d.area_name ?? "";
            const desc = d.description ?? d.characteristics ?? d.summary ?? "";
            const score = d.score ?? d.rating ?? "";
            return `- ${name}${score ? ` (점수: ${score})` : ""}${desc ? `: ${String(desc).slice(0, 150)}` : ""}`;
          }).join("\n");
        }
        return `【마포구 상권 정보】\n${JSON.stringify(data).slice(0, 800)}`;
      }

      default:
        return `[알 수 없는 도구] ${name}`;
    }
  } catch (err) {
    return `[도구 실행 오류] ${String(err)}`;
  }
}

// ── Supabase 서버 클라이언트 (서비스 키 사용) ───────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

// ── 프로필 컨텍스트 빌더 ─────────────────────────────────────────────────────
interface FounderProfile {
  business_type?: string;
  region?: string;
  stage?: string;
  tax_type?: string;
  business_name?: string;
}

async function fetchFounderProfile(
  userId: string
): Promise<FounderProfile | null> {
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data } = await sb
      .from("users")
      .select("business_type, region, stage")
      .eq("id", userId)
      .single();

    if (!data) return null;

    // founder_state에서 상세 단계 조회
    const { data: stateData } = await sb
      .from("founder_state")
      .select("stage, sub_stage")
      .eq("user_id", userId)
      .single();

    // founder_business_info에서 사업자 유형 조회
    const { data: bizData } = await sb
      .from("founder_business_info")
      .select("tax_type, business_name")
      .eq("user_id", userId)
      .single();

    return {
      business_type: data.business_type,
      region: data.region,
      stage: stateData?.stage ?? data.stage,
      tax_type: bizData?.tax_type,
      business_name: bizData?.business_name,
    };
  } catch {
    return null;
  }
}

function buildProfileContext(profile: FounderProfile | null): string {
  if (!profile) return "";
  const lines: string[] = ["\n\n## 현재 사용자 프로필"];
  if (profile.business_name) lines.push(`- 상호명: ${profile.business_name}`);
  if (profile.business_type) lines.push(`- 업종: ${profile.business_type}`);
  if (profile.region) lines.push(`- 지역: ${profile.region}`);
  if (profile.stage) lines.push(`- 창업 단계: ${profile.stage}`);
  if (profile.tax_type) lines.push(`- 사업자 유형: ${profile.tax_type}`);
  return lines.join("\n");
}

// ── 타입 ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  userId?: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

// ── SSE 스트리밍 헬퍼 ────────────────────────────────────────────────────────
function createSSEStream(text: string): ReadableStream {
  const encoder = new TextEncoder();
  // 50자씩 청크 분할 전송 (타이핑 효과)
  const chunks = text.match(/.{1,50}/gs) ?? [text];
  return new ReadableStream({
    start(controller) {
      let i = 0;
      const send = () => {
        if (i >= chunks.length) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: chunks[i] })}\n\n`)
        );
        i++;
        setTimeout(send, 0);
      };
      send();
    },
  });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

// ── POST 핸들러 ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!ANTHROPIC_KEY) {
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

  const { message, history = [], userId } = body;
  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: "메시지를 입력해주세요." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 프로필 컨텍스트 주입 (userId 있을 때만)
  let systemText = SYSTEM_PROMPT;
  if (userId) {
    const profile = await fetchFounderProfile(userId);
    const profileCtx = buildProfileContext(profile);
    if (profileCtx) {
      systemText = SYSTEM_PROMPT + profileCtx;
      writeLog(`[CHATBOT] 프로필 주입: userId=${userId}, stage=${profile?.stage ?? "미상"}, region=${profile?.region ?? "미상"}`);
    }
  }

  const recentHistory = history.slice(-10);
  const commonHeaders = {
    "Content-Type": "application/json",
    "x-api-key": ANTHROPIC_KEY,
    "anthropic-version": ANTHROPIC_VERSION,
    "anthropic-beta": "prompt-caching-2024-07-31",
  };
  const systemBlocks = [
    { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
  ];

  // ── 1단계: 도구 포함 1차 호출 (논스트리밍) ──────────────────────────────
  let firstData: { content: AnthropicContentBlock[]; stop_reason: string };
  try {
    const firstRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemBlocks,
        tools: BOSS_TOOLS,
        tool_choice: { type: "auto" },
        messages: [...recentHistory, { role: "user", content: message }],
      }),
    });

    if (!firstRes.ok) {
      const err = await firstRes.text();
      return new Response(
        JSON.stringify({ error: `Claude API 오류: ${err}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    firstData = await firstRes.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `네트워크 오류: ${String(err)}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 2단계: 도구 실행 여부 판단 ──────────────────────────────────────────
  const toolUseBlocks = firstData.content.filter((b) => b.type === "tool_use");

  // 도구 없이 텍스트 바로 반환
  if (toolUseBlocks.length === 0) {
    writeLog("[CHATBOT] No tools selected — answering directly");
    const text = firstData.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    return new Response(createSSEStream(text), { headers: SSE_HEADERS });
  }

  // ── 3단계: 도구 병렬 실행 ────────────────────────────────────────────────
  const TOOL_LABELS: Record<string, string> = {
    search_laws:           "법령 검색        → POST /rag/search",
    search_subsidies:      "지원사업 검색     → POST /subsidies/search",
    get_tax_deadlines:     "세금 신고 기한    → GET  /tax/deadlines",
    get_ongoing_subsidies: "상시 지원사업     → GET  /subsidies/ongoing",
    get_location_districts:"마포구 상권 정보  → GET  /location/districts",
  };

  writeLog(`[CHATBOT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  writeLog(`[CHATBOT] 선택된 툴 ${toolUseBlocks.length}개: ${toolUseBlocks.map((b) => b.name).join(", ")}`);

  const toolResults = await Promise.all(
    toolUseBlocks.map(async (block) => {
      const toolName = block.name!;
      const toolInput = block.input ?? {};
      const label = TOOL_LABELS[toolName] ?? toolName;
      writeLog(`[CHATBOT] ▶ ${label}`);
      writeLog(`[CHATBOT]   입력값: ${JSON.stringify(toolInput)}`);

      const result = await executeTool(toolName, toolInput);

      const isError = result && typeof result === "object" && "error" in (result as object);
      if (isError) {
        writeLog(`[CHATBOT] ✗ 실패: ${label} → ${(result as { error: string }).error}`);
      } else {
        writeLog(`[CHATBOT] ✓ 성공: ${label}`);
      }

      return {
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      };
    })
  );

  // ── 4단계: 도구 결과 포함 2차 호출 (스트리밍) ───────────────────────────
  const secondMessages = [
    ...recentHistory,
    { role: "user", content: message },
    { role: "assistant", content: firstData.content },
    { role: "user", content: toolResults },
  ];

  let streamRes: Response;
  try {
    streamRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        stream: true,
        system: systemBlocks,
        tools: BOSS_TOOLS,
        messages: secondMessages,
      }),
    });

    if (!streamRes.ok) {
      const err = await streamRes.text();
      return new Response(
        JSON.stringify({ error: `스트리밍 오류: ${err}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `스트리밍 연결 오류: ${String(err)}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Anthropic SSE → 클라이언트 SSE 파이프
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw);
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta"
              ) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`
                  )
                );
              }
            } catch {
              // JSON 파싱 실패 무시
            }
          }
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(readable, { headers: SSE_HEADERS });
}

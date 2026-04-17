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
import { buildSystemPrompt } from "@/lib/chatbot/system_prompt";

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
          description:
            "검색 키워드 (예: '식품위생법 영업신고', '근로계약 최저임금')",
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
          description:
            "검색 키워드 (예: '카페 창업 자금', '소상공인 임차료 지원')",
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
  {
    name: "create_job_posting_draft",
    description:
      "채용공고 초안을 생성하고 서류함에 저장합니다. " +
      "당근마켓·알바천국·사람인 3개 플랫폼용 공고를 동시에 생성합니다. " +
      "사용자가 채용공고 작성을 요청하면 상호명·시급·근무시간 등을 대화로 먼저 수집한 뒤 호출하세요. " +
      "생성된 공고는 서류함에 자동 저장되며 즉시 다운로드 가능합니다.",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string", description: "카페 상호명" },
        neighborhood: {
          type: "string",
          description: "근무 상권 (예: 홍대입구, 합정, 연남동)",
        },
        weekly_hours: { type: "number", description: "주 근무 시간 (예: 20)" },
        hourly_wage: {
          type: "number",
          description: "시급 (원, 최저 10030원 이상)",
        },
        work_days: {
          type: "array",
          items: { type: "string" },
          description: "근무 요일 (예: ['월','화','수','목','금'])",
        },
        work_start: {
          type: "string",
          description: "근무 시작 시간 (예: 09:00)",
        },
        work_end: { type: "string", description: "근무 종료 시간 (예: 14:00)" },
        headcount: { type: "number", description: "모집 인원 (기본 1명)" },
      },
      required: ["business_name"],
    },
  },
  {
    name: "create_labor_contract_draft",
    description:
      "표준 근로계약서 초안을 생성하고 서류함에 저장합니다. " +
      "고용노동부 표준 양식 기반으로 작성됩니다. " +
      "사용자가 근로계약서 작성을 요청하면 근로자 이름·시급·근무일정 등을 대화로 수집한 뒤 호출하세요. " +
      "생성된 계약서는 서류함에 자동 저장되며 즉시 다운로드 가능합니다.",
    input_schema: {
      type: "object",
      properties: {
        worker_name: { type: "string", description: "근로자 이름" },
        business_name: { type: "string", description: "사업장명(카페 상호명)" },
        employer_name: { type: "string", description: "고용주(사장님) 이름" },
        weekly_hours: { type: "number", description: "주 근무 시간 (예: 20)" },
        hourly_wage: {
          type: "number",
          description: "시급 (원, 최저 10030원 이상)",
        },
        contract_start: {
          type: "string",
          description: "계약 시작일 (YYYY-MM-DD)",
        },
        work_days: {
          type: "array",
          items: { type: "string" },
          description: "근무 요일 (예: ['월','화'])",
        },
        work_start: {
          type: "string",
          description: "근무 시작 시간 (예: 09:00)",
        },
        work_end: { type: "string", description: "근무 종료 시간 (예: 14:00)" },
        pay_date: {
          type: "number",
          description: "급여 지급일 (매월 N일, 기본 25)",
        },
      },
      required: ["worker_name", "business_name"],
    },
  },
];

// ── 도구 실행 (팀원 API 호출 — 소스 수정 없음) ───────────────────────────────
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId?: string,
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
        if (!data.length)
          return "[법령 검색 결과 없음] 관련 법령을 찾지 못했습니다.";
        return data
          .slice(0, 5)
          .map((r, i) => {
            const source = r.metadata?.source ?? "출처 미상";
            const article = r.metadata?.article ? ` ${r.metadata.article}` : "";
            return `【법령 ${i + 1}】${source}${article}\n${r.content.slice(0, 500)}`;
          })
          .join("\n\n");
      }

      case "search_subsidies": {
        const res = await fetch(`${API_BASE}/subsidies/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: input.query, match_count: 5 }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok)
          return `[지원사업 검색 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!data.length)
          return "[지원사업 검색 결과 없음] 관련 지원사업을 찾지 못했습니다.";
        return data
          .slice(0, 5)
          .map((r, i) => {
            const deadline = r.end_date
              ? `마감: ${r.end_date}`
              : r.is_ongoing
                ? "상시 모집"
                : "마감일 미정";
            const target = r.target ? `대상: ${r.target}` : "";
            return `【지원사업 ${i + 1}】${r.title} (${r.organization})\n${deadline}${target ? " | " + target : ""}\n${String(r.description ?? "").slice(0, 250)}`;
          })
          .join("\n\n");
      }

      case "get_tax_deadlines": {
        const days = (input.days_ahead as number) ?? 90;
        const res = await fetch(
          `${API_BASE}/tax/deadlines?days_ahead=${days}`,
          {
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!res.ok)
          return `[세금 기한 조회 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as {
          deadlines: Array<Record<string, unknown>>;
        };
        const deadlines = data.deadlines ?? [];
        if (!deadlines.length)
          return "[세금 신고 기한 없음] 해당 기간 내 예정된 세금 신고가 없습니다.";
        return (
          "【세금 신고 기한 목록】\n" +
          deadlines
            .slice(0, 10)
            .map(
              (d) =>
                `- ${d.deadline_date} | ${d.title} (${d.tax_type})\n  ${String(d.description ?? "").slice(0, 150)}`,
            )
            .join("\n")
        );
      }

      case "get_ongoing_subsidies": {
        const res = await fetch(`${API_BASE}/subsidies/ongoing`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
          return `[상시 지원사업 조회 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!data.length)
          return "[상시 지원사업 없음] 현재 상시 모집 중인 지원사업이 없습니다.";
        return (
          "【상시 모집 지원사업】\n" +
          data
            .slice(0, 8)
            .map((r, i) => {
              const target = r.target ? ` | 대상: ${r.target}` : "";
              return `${i + 1}. ${r.title} (${r.organization})${target}\n   ${String(r.description ?? "").slice(0, 200)}`;
            })
            .join("\n\n")
        );
      }

      case "get_location_districts": {
        const res = await fetch(`${API_BASE}/location/districts`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
          return `[상권 정보 조회 실패] 백엔드 응답 오류 (${res.status})`;
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!data || (Array.isArray(data) && !data.length))
          return "[상권 정보 없음] 상권 데이터를 불러오지 못했습니다.";
        if (Array.isArray(data)) {
          return (
            "【마포구 9개 상권 정보】\n" +
            data
              .map((d) => {
                const name = d.name ?? d.district_name ?? d.area_name ?? "";
                const desc =
                  d.description ?? d.characteristics ?? d.summary ?? "";
                const score = d.score ?? d.rating ?? "";
                return `- ${name}${score ? ` (점수: ${score})` : ""}${desc ? `: ${String(desc).slice(0, 150)}` : ""}`;
              })
              .join("\n")
          );
        }
        return `【마포구 상권 정보】\n${JSON.stringify(data).slice(0, 800)}`;
      }

      case "create_job_posting_draft": {
        const postingRes = await fetch(`${API_BASE}/hire/job-posting`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userId ? { "x-user-id": userId } : {}),
          },
          body: JSON.stringify({
            business_name: input.business_name ?? "",
            neighborhood: input.neighborhood ?? "",
            weekly_hours: input.weekly_hours ?? 20,
            hourly_wage: input.hourly_wage ?? 10030,
            work_days: input.work_days ?? [],
            work_start: input.work_start ?? "",
            work_end: input.work_end ?? "",
            headcount: input.headcount ?? 1,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!postingRes.ok)
          return `[채용공고 생성 실패] 백엔드 응답 오류 (${postingRes.status})`;

        const postingData = (await postingRes.json()) as {
          platforms?: { karrot?: string; alba?: string; saramin?: string };
          raw_draft?: string;
        };
        const platforms = {
          karrot: postingData.platforms?.karrot ?? "",
          alba: postingData.platforms?.alba ?? "",
          saramin: postingData.platforms?.saramin ?? "",
        };
        const content =
          `## 당근마켓\n${platforms.karrot}` +
          `\n\n---\n\n## 알바천국\n${platforms.alba}` +
          `\n\n---\n\n## 사람인\n${platforms.saramin}`;
        const title = `채용공고_${input.business_name ?? "카페"}`;

        let draftId: string | null = null;
        if (userId) {
          try {
            const saveRes = await fetch(`${API_BASE}/hire/job-posting/save`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": userId,
              },
              body: JSON.stringify({
                title,
                platforms: {
                  karrot: platforms.karrot,
                  alba: platforms.alba,
                  saramin: platforms.saramin,
                },
                html: "",
                wage_simulation: {},
                inputs: { ...input },
                calculated_at: new Date().toISOString().slice(0, 10),
              }),
              signal: AbortSignal.timeout(8000),
            });
            if (saveRes.ok) {
              const saveData = (await saveRes.json()) as { id?: string };
              draftId = saveData.id ?? null;
            }
          } catch {
            /* 저장 실패해도 초안 반환 */
          }
        }

        const docPayload = JSON.stringify({
          doc_type: "job_posting",
          title,
          draft_id: draftId,
          content,
        });
        return (
          `__DOCUMENT__:${docPayload}\n\n` +
          `채용공고 3종(당근마켓·알바천국·사람인) 초안을 생성했습니다.` +
          (draftId ? " 서류함에 저장되었습니다." : "") +
          `\n\n[당근마켓 미리보기]\n${platforms.karrot.slice(0, 200)}...`
        );
      }

      case "create_labor_contract_draft": {
        const contractRes = await fetch(`${API_BASE}/hire/labor-contract`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userId ? { "x-user-id": userId } : {}),
          },
          body: JSON.stringify({
            worker_name: input.worker_name ?? "",
            business_name: input.business_name ?? "",
            employer_name: input.employer_name ?? "",
            weekly_hours: input.weekly_hours ?? 20,
            hourly_wage: input.hourly_wage ?? 10030,
            contract_start:
              input.contract_start ?? new Date().toISOString().slice(0, 10),
            contract_end: input.contract_end ?? "",
            work_days: input.work_days ?? [],
            work_start: input.work_start ?? "",
            work_end: input.work_end ?? "",
            break_time: 60,
            weekly_holiday: "일요일",
            job_duties: [],
            wage_conditions: [],
            pay_date: input.pay_date ?? 25,
            pay_method: "계좌이체",
            wage_mode: "hourly",
            annual_salary: 0,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!contractRes.ok)
          return `[근로계약서 생성 실패] 백엔드 응답 오류 (${contractRes.status})`;

        const contractData = (await contractRes.json()) as {
          draft?: string;
          [key: string]: unknown;
        };
        const draft =
          contractData.draft ?? JSON.stringify(contractData, null, 2);
        const title = `근로계약서_${input.worker_name ?? "계약서"}`;

        let draftId: string | null = null;
        if (userId) {
          try {
            const saveRes = await fetch(
              `${API_BASE}/hire/labor-contract/save`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-user-id": userId,
                },
                body: JSON.stringify({
                  title,
                  draft,
                  inputs: { ...input },
                  wage_simulation: {},
                }),
                signal: AbortSignal.timeout(8000),
              },
            );
            if (saveRes.ok) {
              const saveData = (await saveRes.json()) as { id?: string };
              draftId = saveData.id ?? null;
            }
          } catch {
            /* 저장 실패해도 초안 반환 */
          }
        }

        const docPayload = JSON.stringify({
          doc_type: "labor_contract",
          title,
          draft_id: draftId,
          content: draft,
        });
        return (
          `__DOCUMENT__:${docPayload}\n\n` +
          `근로계약서 초안을 생성했습니다.` +
          (draftId ? " 서류함에 저장되었습니다." : "") +
          `\n\n[계약서 미리보기]\n${draft.slice(0, 200)}...`
        );
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
  userId: string,
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
          encoder.encode(`data: ${JSON.stringify({ text: chunks[i] })}\n\n`),
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
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청 형식입니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message, history = [], userId } = body;
  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "메시지를 입력해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 15턴 = 메시지 30개 (발표자료 기준 통일)
  const recentHistory = history.slice(-30);

  // 프로필 컨텍스트 주입 (userId 있을 때만)
  let profile: FounderProfile | null = null;
  if (userId) {
    profile = await fetchFounderProfile(userId);
    if (profile) {
      writeLog(
        `[CHATBOT] 프로필 주입: userId=${userId}, stage=${profile.stage ?? "미상"}, region=${profile.region ?? "미상"}`,
      );
    }
  }
  const systemText = buildSystemPrompt({
    founder_stage: profile?.stage,
    region: profile?.region,
    business_type: profile?.business_type,
    current_turn: Math.floor(recentHistory.length / 2),
  });
  const commonHeaders = {
    "Content-Type": "application/json",
    "x-api-key": ANTHROPIC_KEY,
    "anthropic-version": ANTHROPIC_VERSION,
    "anthropic-beta": "prompt-caching-2024-07-31",
  };
  const systemBlocks = [
    { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
  ];

  // ── UI에 표시할 도구별 상태 메시지 ──────────────────────────────────────
  const TOOL_STATUS_LABELS: Record<string, string> = {
    search_laws: "📚 법령 DB 검색 중...",
    search_subsidies: "📢 지원사업 조회 중...",
    get_tax_deadlines: "🗓 세금 신고 기한 확인 중...",
    get_ongoing_subsidies: "📢 상시 지원사업 조회 중...",
    get_location_districts: "📍 상권 분석 중...",
    create_job_posting_draft: "📝 채용공고 초안 작성 중...",
    create_labor_contract_draft: "📄 근로계약서 초안 작성 중...",
  };
  const TOOL_LOG_LABELS: Record<string, string> = {
    search_laws: "법령 검색        → POST /rag/search",
    search_subsidies: "지원사업 검색     → POST /subsidies/search",
    get_tax_deadlines: "세금 신고 기한    → GET  /tax/deadlines",
    get_ongoing_subsidies: "상시 지원사업     → GET  /subsidies/ongoing",
    get_location_districts: "마포구 상권 정보  → GET  /location/districts",
    create_job_posting_draft: "채용공고 초안 생성  → POST /hire/job-posting",
    create_labor_contract_draft:
      "근로계약서 초안 생성 → POST /hire/labor-contract",
  };

  // ── 즉시 SSE 스트림 시작 — 클라이언트에 실시간 상태 전달 ─────────────────
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const enqueue = (data: Record<string, string> | string) => {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };
      const sendStatus = (text: string) => enqueue({ type: "status", text });
      const sendText = (text: string) => enqueue({ type: "text", text });
      const sendDone = () => {
        enqueue("[DONE]");
        controller.close();
      };

      try {
        sendStatus("질문 분석 중...");

        // ── 에이전틱 루프: 최대 MAX_TOOL_ROUNDS 라운드 도구 재호출 지원 ─────
        const MAX_TOOL_ROUNDS = 4;
        let messages: Array<{ role: string; content: unknown }> = [
          ...recentHistory,
          { role: "user", content: message },
        ];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          // 매 라운드 Claude 호출 (논스트리밍 — 도구 재호출 감지 필요)
          let roundData: {
            content: AnthropicContentBlock[];
            stop_reason: string;
          };
          try {
            const roundRes = await fetch(
              "https://api.anthropic.com/v1/messages",
              {
                method: "POST",
                headers: commonHeaders,
                body: JSON.stringify({
                  model: MODEL,
                  max_tokens: round === 0 ? 1024 : 1500,
                  system: systemBlocks,
                  tools: BOSS_TOOLS,
                  tool_choice: { type: "auto" },
                  messages,
                }),
              },
            );
            if (!roundRes.ok) {
              sendText(`[오류] Claude API 응답 실패 (${roundRes.status})`);
              return;
            }
            roundData = await roundRes.json();
          } catch (err) {
            sendText(`[오류] 네트워크 오류: ${String(err)}`);
            return;
          }

          const toolUseBlocks = roundData.content.filter(
            (b) => b.type === "tool_use",
          );

          // 도구 호출 없음 → 최종 답변 스트리밍
          if (
            toolUseBlocks.length === 0 ||
            roundData.stop_reason === "end_turn"
          ) {
            writeLog(
              `[CHATBOT] round=${round + 1} end_turn — 답변 스트리밍 시작`,
            );
            const finalText = roundData.content
              .filter((b) => b.type === "text")
              .map((b) => b.text ?? "")
              .join("");

            // 50자 청크로 타이핑 효과 스트리밍
            const chunks = finalText.match(/.{1,50}/gs) ?? [finalText];
            for (const chunk of chunks) {
              sendText(chunk);
              await new Promise((r) => setTimeout(r, 0));
            }
            return;
          }

          // 도구 호출 있음 → 상태 표시 + 병렬 실행
          writeLog(
            `[CHATBOT] round=${round + 1} tool_use ${toolUseBlocks.length}개: ${toolUseBlocks.map((b) => b.name).join(", ")}`,
          );
          for (const block of toolUseBlocks) {
            sendStatus(TOOL_STATUS_LABELS[block.name!] ?? "데이터 조회 중...");
          }

          const toolResults = await Promise.all(
            toolUseBlocks.map(async (block) => {
              const toolName = block.name!;
              const toolInput = block.input ?? {};
              const logLabel = TOOL_LOG_LABELS[toolName] ?? toolName;
              writeLog(`[CHATBOT] ▶ ${logLabel}`);
              writeLog(`[CHATBOT]   입력값: ${JSON.stringify(toolInput)}`);
              let result = await executeTool(toolName, toolInput, userId);
              writeLog(`[CHATBOT] ✓ 완료: ${logLabel}`);

              // __DOCUMENT__ 마커 파싱 → SSE document 이벤트 발신
              const DOC_MARKER = "__DOCUMENT__:";
              if (result.startsWith(DOC_MARKER)) {
                const newlineIdx = result.indexOf("\n\n");
                const jsonPart =
                  newlineIdx > -1
                    ? result.slice(DOC_MARKER.length, newlineIdx)
                    : result.slice(DOC_MARKER.length);
                try {
                  const docPayload = JSON.parse(jsonPart);
                  enqueue({ type: "document", ...docPayload });
                } catch {
                  /* JSON 파싱 실패 무시 */
                }
                result = newlineIdx > -1 ? result.slice(newlineIdx + 2) : "";
              }

              return {
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
              };
            }),
          );

          // 다음 라운드를 위해 메시지에 도구 결과 추가
          messages = [
            ...messages,
            { role: "assistant", content: roundData.content },
            { role: "user", content: toolResults },
          ];
          sendStatus("답변 생성 중...");
        }

        // MAX_TOOL_ROUNDS 초과 시 안내
        sendText(
          "죄송합니다, 정보를 찾는 중 문제가 발생했습니다. 질문을 좀 더 구체적으로 입력해 주세요.",
        );
      } finally {
        sendDone();
      }
    },
  });

  return new Response(readable, { headers: SSE_HEADERS });
}

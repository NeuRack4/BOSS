/**
 * BOSS 챗봇 LangChain Tool 정의
 *
 * 기존 route.ts의 executeTool() 정규화 로직을 그대로 재사용.
 * LangChain tool() 포맷으로 래핑만 함.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── search_laws ──────────────────────────────────────────────────────────────
export const searchLawsTool = tool(
  async ({ query, category }: { query: string; category?: string }) => {
    try {
      const res = await fetch(`${API_BASE}/rag/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          match_count: 5,
          ...(category ? { category } : {}),
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
    } catch (err) {
      return `[도구 실행 오류] ${String(err)}`;
    }
  },
  {
    name: "search_laws",
    description:
      "Supabase에 임베딩된 실제 법령·규정·절차 원문을 검색합니다. " +
      "사업자등록, 식품위생법, 근로기준법, 상가임대차보호법, 부가가치세법 등 " +
      "카페 창업·운영 관련 모든 법령이 포함됩니다. " +
      "절차·신고·법령·계약 관련 질문에는 반드시 이 도구를 먼저 호출하세요.",
    schema: z.object({
      query: z.string().describe("검색 키워드 (예: '식품위생법 영업신고')"),
      category: z
        .enum(["license", "tax", "labor", "lease", "subsidy", "regulation"])
        .optional()
        .describe("카테고리 필터(선택)"),
    }),
  },
);

// ── search_subsidies ─────────────────────────────────────────────────────────
export const searchSubsidiesTool = tool(
  async ({ query }: { query: string }) => {
    try {
      const res = await fetch(`${API_BASE}/subsidies/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, match_count: 5 }),
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
    } catch (err) {
      return `[도구 실행 오류] ${String(err)}`;
    }
  },
  {
    name: "search_subsidies",
    description:
      "창업자가 신청 가능한 지원사업·보조금을 검색합니다. " +
      "기업마당 공고 기반으로 자금지원, 교육, 컨설팅, 임차료 지원 등을 검색합니다.",
    schema: z.object({
      query: z.string().describe("검색 키워드 (예: '카페 창업 자금')"),
    }),
  },
);

// ── get_tax_deadlines ────────────────────────────────────────────────────────
export const getTaxDeadlinesTool = tool(
  async ({ days_ahead }: { days_ahead?: number }) => {
    try {
      const days = days_ahead ?? 90;
      const res = await fetch(`${API_BASE}/tax/deadlines?days_ahead=${days}`, {
        signal: AbortSignal.timeout(5000),
      });
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
    } catch (err) {
      return `[도구 실행 오류] ${String(err)}`;
    }
  },
  {
    name: "get_tax_deadlines",
    description:
      "다가오는 세금 신고·납부 기한을 실시간으로 조회합니다. " +
      "부가가치세, 종합소득세, 원천세 기한을 현재 날짜 기준으로 가져옵니다.",
    schema: z.object({
      days_ahead: z
        .number()
        .optional()
        .describe("조회 기간 (일 수, 기본 90일)"),
    }),
  },
);

// ── get_ongoing_subsidies ────────────────────────────────────────────────────
export const getOngoingSubsidiesTool = tool(
  async () => {
    try {
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
    } catch (err) {
      return `[도구 실행 오류] ${String(err)}`;
    }
  },
  {
    name: "get_ongoing_subsidies",
    description:
      "현재 상시 모집 중인 지원사업 목록을 조회합니다. " +
      "연중 신청 가능한 지원사업을 확인할 때 사용합니다.",
    schema: z.object({}),
  },
);

// ── get_location_districts ───────────────────────────────────────────────────
export const getLocationDistrictsTool = tool(
  async () => {
    try {
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
    } catch (err) {
      return `[도구 실행 오류] ${String(err)}`;
    }
  },
  {
    name: "get_location_districts",
    description:
      "마포구 카페 창업 가능 상권 목록과 정보를 조회합니다. " +
      "홍대입구, 합정, 연남동, 망원동, 공덕, 성산동 등 상권별 특성을 제공합니다.",
    schema: z.object({}),
  },
);

// ── 전체 도구 배열 ────────────────────────────────────────────────────────────
export const BOSS_AGENT_TOOLS = [
  searchLawsTool,
  searchSubsidiesTool,
  getTaxDeadlinesTool,
  getOngoingSubsidiesTool,
  getLocationDistrictsTool,
];

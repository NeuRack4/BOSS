/**
 * BOSS 챗봇 테스트 하네스
 *
 * 실행: npx tsx scripts/test_harness.ts
 * 전제: localhost:3000 (Next.js dev server) 실행 중이어야 함
 *
 * 5개 시나리오를 자동으로 POST /api/chat 에 전송하고
 * 응답을 채점하여 docs/chatbot-test-results-YYYYMMDD.md 로 저장
 */

import fs from "fs";
import path from "path";

const BASE_URL = process.env.CHATBOT_URL ?? "http://localhost:3000";
const CHAT_ENDPOINT = `${BASE_URL}/api/chat`;
const CHAT_V2_ENDPOINT = `${BASE_URL}/api/chat-v2`;

// ── 테스트 시나리오 정의 ────────────────────────────────────────────────────
/**
 * toolEvidencePatterns: Claude의 최종 응답에서 도구 호출 여부를 간접 확인하는 패턴.
 *
 * 이유: Claude는 도구 결과(【법령 N】...)를 그대로 출력하지 않고
 * 자연어로 재작성하기 때문에, 마커 대신 도구 호출 시에만 나타나는
 * 법령 조항 번호·날짜·지역명 등의 패턴으로 판정.
 */
interface Scenario {
  id: number;
  name: string;
  question: string;
  toolEvidencePatterns: RegExp[]; // 도구 호출 간접 증거 (응답 텍스트 내 패턴)
  toolEvidenceDesc: string; // 로그용 설명
  expectedKeywords: string[]; // 응답 텍스트에서 확인할 키워드
  maxTimeMs: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    name: "식품위생 영업신고",
    question: "카페 창업하려면 어떤 신고 해야 해?",
    // search_laws 호출 시 법령 조항 번호가 응답에 등장
    toolEvidencePatterns: [/제\d+조/, /식품위생법/, /영업신고/],
    toolEvidenceDesc: "법령 조항 번호(제N조) 또는 '식품위생법' 언급",
    expectedKeywords: ["식품위생", "영업신고", "위생"],
    maxTimeMs: 15000,
  },
  {
    id: 2,
    name: "지원사업 검색",
    question: "지금 신청 가능한 지원사업 있어?",
    // search_subsidies/get_ongoing_subsidies 호출 시 기관명·마감일 등장
    toolEvidencePatterns: [/\d{4}년 \d+월/, /지원사업/, /모집/],
    toolEvidenceDesc: "날짜 패턴(YYYY년 N월) 또는 구체적 지원사업명 언급",
    expectedKeywords: ["지원사업", "신청", "모집"],
    maxTimeMs: 15000,
  },
  {
    id: 3,
    name: "부가세 신고 기한",
    question: "부가세 신고 언제야?",
    // get_tax_deadlines 호출 시 구체적 날짜(월/일)가 응답에 등장
    toolEvidencePatterns: [
      /\d{4}년 \d+월 \d+일/,
      /예정신고/,
      /확정신고/,
      /납부기한/,
    ],
    toolEvidenceDesc:
      "구체적 날짜(YYYY년 N월 N일) 또는 '예정신고'/'확정신고' 언급",
    expectedKeywords: ["부가세", "신고", "2026"],
    maxTimeMs: 12000,
  },
  {
    id: 4,
    name: "마포구 입지 분석",
    question: "홍대에서 카페 창업하면 어때?",
    // get_location_districts 호출 시 구체적 상권명 다수 등장
    toolEvidencePatterns: [/연남동|망원동|합정|공덕|성산동|홍대입구/],
    toolEvidenceDesc: "마포구 상권명(연남동·망원동·합정 등) 구체 언급",
    expectedKeywords: ["홍대", "상권"],
    maxTimeMs: 12000,
  },
  {
    id: 5,
    name: "근로계약서",
    question: "알바 뽑고 근로계약서 써야 하는데 어떻게 해?",
    // search_laws 호출 시 근로기준법 조항 번호 등장
    toolEvidencePatterns: [/제\d+조/, /근로기준법/, /근로계약/],
    toolEvidenceDesc: "법령 조항 번호(제N조) 또는 '근로기준법' 언급",
    expectedKeywords: ["근로계약", "최저임금"],
    maxTimeMs: 15000,
  },
];

// ── SSE 스트림 수집 ─────────────────────────────────────────────────────────
async function collectSSEResponse(
  endpoint: string,
  question: string,
): Promise<{ text: string; elapsedMs: number; error?: string }> {
  const start = Date.now();

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history: [] }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return {
        text: "",
        elapsedMs: Date.now() - start,
        error: `HTTP ${res.status}`,
      };
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

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
          if (parsed.text) fullText += parsed.text;
        } catch {
          // 파싱 실패 무시
        }
      }
    }

    return { text: fullText, elapsedMs: Date.now() - start };
  } catch (err) {
    return {
      text: "",
      elapsedMs: Date.now() - start,
      error: String(err),
    };
  }
}

// ── 채점 로직 ────────────────────────────────────────────────────────────────
interface ScoreResult {
  toolScore: number; // 40점 만점
  keywordScore: number; // 40점 만점
  timeScore: number; // 20점 만점
  total: number; // 100점 만점
  toolHit: boolean;
  foundKeywords: string[];
  missingKeywords: string[];
  elapsedMs: number;
  responsePreview: string;
  error?: string;
}

function scoreResponse(
  scenario: Scenario,
  text: string,
  elapsedMs: number,
  error?: string,
): ScoreResult {
  if (error || !text) {
    return {
      toolScore: 0,
      keywordScore: 0,
      timeScore: 0,
      total: 0,
      toolHit: false,
      foundKeywords: [],
      missingKeywords: scenario.expectedKeywords,
      elapsedMs,
      responsePreview: "",
      error: error ?? "응답 없음",
    };
  }

  // 도구 호출 간접 증거 확인 (Claude 최종 응답에서 패턴 탐지)
  const toolHit = scenario.toolEvidencePatterns.some((pattern) =>
    pattern.test(text),
  );
  const toolScore = toolHit ? 40 : 0;

  // 키워드 확인
  const foundKeywords = scenario.expectedKeywords.filter((kw) =>
    text.includes(kw),
  );
  const missingKeywords = scenario.expectedKeywords.filter(
    (kw) => !text.includes(kw),
  );
  const keywordRatio = foundKeywords.length / scenario.expectedKeywords.length;
  const keywordScore = Math.round(keywordRatio * 40);

  // 응답 시간
  let timeScore = 0;
  if (elapsedMs <= 10000) timeScore = 20;
  else if (elapsedMs <= 15000) timeScore = 10;

  const total = toolScore + keywordScore + timeScore;

  return {
    toolScore,
    keywordScore,
    timeScore,
    total,
    toolHit,
    foundKeywords,
    missingKeywords,
    elapsedMs,
    responsePreview: text.slice(0, 200).replace(/\n/g, " "),
  };
}

// ── 결과 MD 생성 ─────────────────────────────────────────────────────────────
function buildMarkdownReport(
  label: string,
  endpoint: string,
  results: Array<{ scenario: Scenario; score: ScoreResult }>,
): string {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const totalScore = results.reduce((s, r) => s + r.score.total, 0);
  const maxScore = results.length * 100;
  const avgMs = Math.round(
    results.reduce((s, r) => s + r.score.elapsedMs, 0) / results.length,
  );
  const passed = totalScore >= maxScore * 0.8;

  let md = `## ${label} — ${now}\n\n`;
  md += `**엔드포인트:** \`${endpoint}\`\n\n`;
  md += `**총점: ${totalScore}/${maxScore} (${Math.round((totalScore / maxScore) * 100)}%)** ${passed ? "✅ 합격" : "❌ 불합격"}\n\n`;
  md += `**평균 응답 시간: ${(avgMs / 1000).toFixed(1)}초**\n\n`;
  md += `| # | 시나리오 | 도구(40) | 키워드(40) | 시간(20) | 합계 | 응답시간 |\n`;
  md += `|---|---------|---------|-----------|---------|------|--------|\n`;

  for (const { scenario, score } of results) {
    const toolCell = score.error
      ? `❌ 오류`
      : score.toolHit
        ? `✅ ${score.toolScore}`
        : `❌ 0`;
    const kwCell = `${score.foundKeywords.length}/${scenario.expectedKeywords.length} → ${score.keywordScore}점`;
    const timeCell = `${(score.elapsedMs / 1000).toFixed(1)}s → ${score.timeScore}점`;
    md += `| ${scenario.id} | ${scenario.name} | ${toolCell} | ${kwCell} | ${timeCell} | **${score.total}** | ${(score.elapsedMs / 1000).toFixed(1)}s |\n`;
  }

  md += `\n### 상세 결과\n\n`;
  for (const { scenario, score } of results) {
    md += `#### Q${scenario.id}: ${scenario.name}\n`;
    md += `- 질문: "${scenario.question}"\n`;
    if (score.error) {
      md += `- ❌ 오류: ${score.error}\n`;
    } else {
      md += `- 도구 호출 증거: ${score.toolHit ? "✅ 감지됨" : "❌ 미감지"} (판정 기준: ${scenario.toolEvidenceDesc})\n`;
      md += `- 발견 키워드: ${score.foundKeywords.length > 0 ? score.foundKeywords.join(", ") : "없음"}\n`;
      if (score.missingKeywords.length > 0) {
        md += `- 누락 키워드: ${score.missingKeywords.join(", ")}\n`;
      }
      md += `- 응답 시간: ${(score.elapsedMs / 1000).toFixed(1)}초\n`;
      md += `- 응답 미리보기: ${score.responsePreview}...\n`;
    }
    md += `\n`;
  }

  return md;
}

// ── 메인 실행 ────────────────────────────────────────────────────────────────
async function runTests(endpoint: string, label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[테스트] ${label}`);
  console.log(`엔드포인트: ${endpoint}`);
  console.log("=".repeat(60));

  const results: Array<{ scenario: Scenario; score: ScoreResult }> = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`[Q${scenario.id}] ${scenario.name} ... `);
    const { text, elapsedMs, error } = await collectSSEResponse(
      endpoint,
      scenario.question,
    );
    const score = scoreResponse(scenario, text, elapsedMs, error);
    results.push({ scenario, score });

    const status = score.error
      ? `❌ 오류 (${score.error})`
      : `${score.total}/100점 (${(elapsedMs / 1000).toFixed(1)}s)`;
    console.log(status);
  }

  return results;
}

async function main() {
  // YYYYMMDD-HHMMSS 형식 — 같은 날 여러 번 실행해도 파일이 쌓임
  const now = new Date();
  const dateTimeStr =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const outputPath = path.join(
    process.cwd(),
    "..",
    "docs",
    `chatbot-test-results-${dateTimeStr}.md`,
  );

  // v1 테스트
  const v1Results = await runTests(CHAT_ENDPOINT, "chat v1 (raw fetch)");

  // v2 테스트 (서버에 endpoint 없으면 스킵)
  let v2Results: Array<{ scenario: Scenario; score: ScoreResult }> | null =
    null;
  try {
    const probe = await fetch(CHAT_V2_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "테스트", history: [] }),
      signal: AbortSignal.timeout(3000),
    });
    if (probe.ok || probe.status === 500) {
      v2Results = await runTests(CHAT_V2_ENDPOINT, "chat v2 (LangChain)");
    }
  } catch {
    console.log("\n[SKIP] chat-v2 서버 없음 — v2 테스트 건너뜀");
  }

  // MD 리포트 생성
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  let report = `# BOSS 챗봇 테스트 결과\n\n테스트 일시: ${now}\n\n`;
  report += buildMarkdownReport(
    "chat v1 (raw fetch)",
    CHAT_ENDPOINT,
    v1Results,
  );
  if (v2Results) {
    report += "\n---\n\n";
    report += buildMarkdownReport(
      "chat v2 (LangChain)",
      CHAT_V2_ENDPOINT,
      v2Results,
    );

    // v1 vs v2 비교표
    const v1Total = v1Results.reduce((s, r) => s + r.score.total, 0);
    const v2Total = v2Results.reduce((s, r) => s + r.score.total, 0);
    report += `\n---\n\n## v1 vs v2 비교\n\n`;
    report += `| 버전 | 총점 | 평균 응답시간 |\n|------|------|-------------|\n`;
    const v1Avg =
      v1Results.reduce((s, r) => s + r.score.elapsedMs, 0) / v1Results.length;
    const v2Avg =
      v2Results.reduce((s, r) => s + r.score.elapsedMs, 0) / v2Results.length;
    report += `| v1 (raw fetch) | ${v1Total}/500 | ${(v1Avg / 1000).toFixed(1)}s |\n`;
    report += `| v2 (LangChain) | ${v2Total}/500 | ${(v2Avg / 1000).toFixed(1)}s |\n`;
  }

  // 파일 저장
  const docsDir = path.dirname(outputPath);
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(outputPath, report, "utf8");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`결과 저장: ${outputPath}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("[오류]", err);
  process.exit(1);
});

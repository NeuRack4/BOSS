# 챗봇 v4 — 개선 항목 상세 설명 (개인 메모)

> feature/chatbot-v4 브랜치 작업 전 개인 이해용. 멘토 피드백 기반.

---

## 1. 테스트 하네스 (Test Harness)

### 뭐야?

챗봇이 제대로 동작하는지 자동으로 평가하는 스크립트.
사람이 일일이 질문을 입력해서 확인하는 게 아니라,
5개의 미리 정해진 시나리오 질문을 자동으로 보내고 결과를 채점해서 MD 파일로 저장해줌.

### 웹브라우저에서 직접 하는 건가? 아니면 스크립트가 하는 건가?

**스크립트가 함.** 브라우저 아님.

동작 방식:

```
터미널에서 스크립트 실행
    ↓
5개 질문을 chatbot API (POST /api/chat)에 자동 전송
    ↓
응답 텍스트 받아서 채점
    ↓
점수 + 상세 결과를 MD 파일로 저장
```

내가(Claude Code) 스크립트를 만들면, **사용자가 터미널에서 직접 실행**.
실행 명령: `npx tsx scripts/test_chatbot.ts` 또는 `python scripts/test_chatbot.py`

### 5개 평가 시나리오

| #   | 질문                                 | 평가 기준                                             |
| --- | ------------------------------------ | ----------------------------------------------------- |
| 1   | "카페 창업하려면 어떤 신고 해야 해?" | search_laws 호출 여부 + 식품위생법 언급 여부          |
| 2   | "지금 신청 가능한 지원사업 있어?"    | search_subsidies 또는 get_ongoing_subsidies 호출 여부 |
| 3   | "부가세 신고 언제야?"                | get_tax_deadlines 호출 여부 + 날짜 포함 여부          |
| 4   | "홍대 근처에서 카페 창업하면 어때?"  | get_location_districts 호출 여부                      |
| 5   | "알바 구하고 근로계약서 써야 하는데" | search_laws 호출 + 근로기준법/최저임금 언급 여부      |

### 수치화 결과 예시 (저장되는 MD)

```markdown
## 챗봇 테스트 결과 — 2026-04-16 14:30

| 시나리오      | 도구 호출                 | 응답 키워드 포함     | 응답 시간 | 점수 |
| ------------- | ------------------------- | -------------------- | --------- | ---- |
| 식품위생 신고 | ✅ search_laws            | ✅ 식품위생법 제37조 | 3.2s      | 100  |
| 지원사업      | ✅ search_subsidies       | ✅ 마감일 포함       | 2.8s      | 100  |
| 부가세 기한   | ✅ get_tax_deadlines      | ✅ 날짜 포함         | 1.9s      | 100  |
| 입지 분석     | ✅ get_location_districts | ✅ 홍대 언급         | 2.1s      | 100  |
| 근로계약서    | ✅ search_laws            | ❌ 최저임금 미언급   | 3.5s      | 80   |

**총점: 96/100 (합격)**
**평균 응답 시간: 2.7초**
```

### git에 올릴 때

평가 결과 파일 (`docs/chatbot-test-results-YYYYMMDD.md`)을 작업 파일과 함께 커밋.

---

## 2. LangChain `create_agent()` 마이그레이션

### LangChain이 뭐야?

LLM 애플리케이션을 만들기 위한 프레임워크.
Claude, GPT 같은 모델 + 도구(Tool) + 메모리를 연결하는 **공통 인터페이스**를 제공함.

우리 프로젝트 언어는 TypeScript(Next.js)이므로 `@langchain/core` + `@langchain/anthropic` 패키지를 사용.

### 지금 구조 vs LangChain 구조

**지금 (raw fetch 루프):**

```
route.ts 안에서 직접 구현:
1. fetch("https://api.anthropic.com/...") — 1차 호출
2. toolUseBlocks 뽑아서 executeTool() 수동 실행
3. fetch("https://api.anthropic.com/...") — 2차 호출 (스트리밍)
```

**LangChain AgentExecutor 구조:**

```
createReactAgent(llm, tools) 로 에이전트 생성
    ↓
agent.stream({ input: message }) 호출 한 번
    ↓
LangChain이 내부에서 루프 자동 처리
(도구 선택 → 실행 → 결과 반환 → 최종 답변)
```

### 어떻게 구현할 계획?

신규 파일로만 추가 (기존 route.ts 수정 안 함):

```
frontend/app/api/chat-v2/route.ts   ← LangChain 버전 (신규)
frontend/lib/chatbot/agent.ts       ← AgentExecutor 설정
frontend/lib/chatbot/tools.ts       ← 5개 Tool 정의
```

핵심 코드 구조:

```typescript
// agent.ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import { bossTools } from "./tools";

const llm = new ChatAnthropic({ model: "claude-haiku-4-5" });
export const agent = createReactAgent({ llm, tools: bossTools });
```

```typescript
// tools.ts (search_laws 예시)
import { tool } from "@langchain/core/tools";

export const searchLawsTool = tool(
  async ({ query, category }) => {
    const res = await fetch(`${API_BASE}/rag/search`, { ... });
    // executeTool()과 동일한 정규화 로직
    return normalizedText;
  },
  {
    name: "search_laws",
    description: "...",
    schema: z.object({ query: z.string(), category: z.string().optional() }),
  }
);
```

### 하는 이유와 목적

| 항목           | 내용                                                                 |
| -------------- | -------------------------------------------------------------------- |
| 현재 문제      | route.ts에 루프 로직이 복잡하게 섞여있음                             |
| LangChain 장점 | 도구 추가/제거가 tools 배열만 수정하면 됨. 루프 로직 신경 안 써도 됨 |
| 확장성         | 나중에 도구 10개, 20개 돼도 구조 유지                                |
| 생태계         | 메모리, 체인, 평가 도구 등 LangChain 생태계 활용 가능                |

### 솔직한 평가

지금 도구가 5개뿐이고 루프도 단순 2단계라서 **지금 당장은 LangChain이 오버킬일 수 있음**.
다만 멘토가 피드백으로 언급했으면, 코드 구조의 확장성을 보여주기 위한 목적이 큰 것으로 이해.
**v4에서 병렬로 route-v2로 만들어두고 비교 테스트하는 방향 추천**.

---

## 3. 창업자 프로필 컨텍스트 주입

### 어디에다가 하는 거야?

**시스템 프롬프트 안에** 넣음. DB 구조 변경 없음. 중복 저장 없음.

지금 시스템 프롬프트:

```
당신은 BOSS의 카페 창업 전담 AI 비서입니다...
(고정 텍스트)
```

주입 후:

```
당신은 BOSS의 카페 창업 전담 AI 비서입니다...
(고정 텍스트)

## 현재 사용자 프로필
- 업종: 카페
- 단계: 초기운영 (오픈 2개월)
- 지역: 마포구 합정동
- 사업자 유형: 간이과세자
```

### 어떻게 주입하냐?

요청이 들어올 때 Supabase에서 사용자 프로필을 한 번 읽어서 프롬프트에 문자열로 붙임.

```typescript
// route.ts (POST 핸들러 내부)
const profile = await fetchFounderProfile(userId); // Supabase 1회 조회
const systemWithProfile = SYSTEM_PROMPT + buildProfileContext(profile);
```

```typescript
function buildProfileContext(profile: FounderProfile): string {
  if (!profile) return "";
  return `\n\n## 현재 사용자 프로필\n- 업종: ${profile.business_type}\n- 단계: ${profile.stage}\n- 지역: ${profile.region}\n- 사업자 유형: ${profile.tax_type}`;
}
```

### 토큰 더 많이 써서 돈 더 나가는 거 아닌가?

**아주 조금** 더 나가지만 무시할 수준.

프로필 텍스트 4줄 ≈ **50~80 토큰 추가**.
claude-haiku-4-5 기준 1000 토큰 = $0.00025.
즉 요청 1회당 **$0.00002 미만 추가** → 사실상 0원.

그리고 프롬프트 캐싱(`cache_control: ephemeral`)을 이미 적용했기 때문에
시스템 프롬프트는 5분마다 1번만 과금. 추가 비용 거의 없음.

### DB 중복 저장?

없음. Supabase에서 **기존 `users` 또는 `founder_state` 테이블을 읽기만** 함.
새로운 테이블 생성 없음. 쓰기 없음.

### 이걸 하면 뭐가 좋아?

지금은 사용자가 "저 합정에서 카페 하고 있어요" 를 매번 말해야 함.
주입 후엔 Claude가 처음부터 알고 있으니 대화가 더 자연스럽고 맞춤형이 됨.

---

## 4. 대화 요약 메모리

### 어제 내가 비추천한다고 했잖아 — 이유가 뭐였어?

맞음. 이유는:

BOSS 챗봇은 **법령·세금 기한·계약 조항** 같은 정밀한 정보를 다룸.
요약을 하면 "식품위생법 제37조에 따르면 영업신고 전에..." 같은 구체적 정보가
"식품위생 관련 얘기를 나눴음" 수준으로 뭉개질 위험이 있음.

### 지금 구조

```typescript
const recentHistory = history.slice(-10); // 최근 10개 메시지만 유지
```

10개면 사용자-Claude 왕복 5번. 대부분의 대화 흐름은 이 안에 들어옴.

### 요약 메모리를 하면 어떻게 달라지나?

```
메시지 10개 이상 쌓이면:
- 앞의 8개를 Claude에게 요약 요청
- "사장님이 합정 카페 창업 중이고, 식품위생신고 얘기를 나눴음. 부가세 간이과세 선택함."
- 요약 1개 + 최근 2개 메시지로 교체
```

### 솔직한 결론: 지금 필요한가?

**필요성 낮음.** 이유:

| 항목                    | 내용                                                       |
| ----------------------- | ---------------------------------------------------------- |
| 현재 history.slice(-10) | 대부분의 세션에서 충분함                                   |
| 정보 손실 위험          | 법령/날짜/계약 내용이 요약 과정에서 손실 가능              |
| 구현 복잡도             | 요약 자체가 Claude 호출 1번 추가 = 비용+지연 증가          |
| 언제 필요해지냐         | 한 세션에서 20~30개 이상 메시지 주고받는 헤비 유저 생길 때 |

**지금은 3번(프로필 컨텍스트 주입)이 훨씬 효과 대비 비용이 낮음.**
멘토가 언급했다면, "이런 개념이 있고 이렇게 구현한다"는 걸 아는 것 자체가 목적일 수 있음.
**당장 구현보다 설명만 준비해도 충분.**

---

## 우선순위 재정리 (내 판단)

| 순위 | 항목                   | 이유                                     |
| ---- | ---------------------- | ---------------------------------------- |
| 1    | 테스트 하네스          | 결과를 수치로 보여줄 수 있어서 임팩트 큼 |
| 2    | 프로필 컨텍스트 주입   | 구현 쉽고 실사용 개선 체감 직접적        |
| 3    | LangChain 마이그레이션 | 구조 개선, 멘토 피드백 직접 반영         |
| 4    | 요약 메모리            | 지금은 필요성 낮음. 설계안만 준비        |

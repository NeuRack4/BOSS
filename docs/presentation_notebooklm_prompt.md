# BOSS — 10-Minute Mid-Development Mentor Review

## Gemini Prompt: 15-Slide Technical Progress Presentation

---

### INSTRUCTIONS FOR GEMINI

Write a 10-minute **mid-development mentor review** presentation for **BOSS (Business Operations Support System)**.
Audience: technical mentors. Tone: honest, builder-focused. Language: English.
Each slide: **Title + Key Visual (simple) + Spoken Script (3–4 sentences, ~40 sec) + Transition.**
Keep visuals minimal — one diagram or one key point per slide, no version numbers.

---

## SLIDE 1 — Title

**Slide Title:** "BOSS: A Proactive AI Assistant for Solo Café Founders"

**Key Visual:**
Logo + tagline: _"Business Operations Support System"_
Three words centered: `RAG · Multi-Agent · ML`
Subtitle: _Seoul Mapo-gu · Café Domain_

**Spoken Script:**
BOSS is a proactive AI assistant built for first-time café owners in Seoul's Mapo-gu district. Instead of waiting for the founder to ask a question, the system detects the right moment and delivers a ready-to-submit draft. Today I'll cover what's been built, how each AI system works, where we are now, and where we're heading.

**Transition:** "Let me start with the problem."

---

## SLIDE 2 — Problem

**Slide Title:** "One Person. Every Role."

**Key Visual:**
Single founder icon in the center, surrounded by 5 labels:
`Compliance` · `Tax` · `Hiring` · `Subsidies` · `Operations`
Caption: _"No staff. No advisor. 70+ hours a week."_

**Spoken Script:**
A solo café founder is simultaneously accountant, HR manager, and compliance officer. They miss government subsidy deadlines not because they're careless — no one surfaced the information at the right time. The system's job is to monitor context and act before the founder realizes action is needed.

**Transition:** "That design constraint shaped every architectural decision."

---

## SLIDE 3 — Solution

**Slide Title:** "Proactive, Not Reactive"

**Key Visual:**
Two-column comparison:

- LEFT: _"Reactive"_ — User asks → System answers
- RIGHT: _"Proactive (BOSS)"_ — System detects → Draft ready → User reviews & submits

**Spoken Script:**
Most tools answer questions. BOSS acts first. It monitors the founder's business stage, calendar, and operational signals — then surfaces the right draft at the right time. The founder's only job is to review and submit. We removed the hardest part: knowing what to do next.

**Transition:** "Here's how the system is structured overall."

---

## SLIDE 4 — Architecture

**Slide Title:** "Three Layers: Frontend · Backend · AI"

**Key Visual:**
Vertical stack:

```
Next.js 14 PWA  (Vercel)
       ↓
FastAPI  +  APScheduler
       ↓
LangGraph Orchestrator  →  5 Agents
       ↓
Supabase: PostgreSQL + pgvector + Realtime
```

**Spoken Script:**
The frontend is a Next.js PWA — it runs as a mobile app without a native build. FastAPI handles 18 API routes with a cron scheduler for time-based triggers. The intelligence layer is a LangGraph state machine routing to five specialized agents. Everything persists in Supabase with Row Level Security on every table.

**Transition:** "The AI work spans four distinct domains."

---

## SLIDE 5 — AI Domains

**Slide Title:** "Four AI Domains, One System"

**Key Visual:**
2×2 grid:

- 🔍 **Hybrid RAG** — Knowledge retrieval
- 🤖 **Multi-Agent** — Stage-driven orchestration
- 📊 **ML Scoring** — Location & revenue prediction
- 💬 **Agentic Chat** — Tool use + streaming

**Spoken Script:**
The system integrates four AI domains that each handle a different layer of the problem. Hybrid RAG retrieves regulatory and subsidy knowledge. Multi-agent orchestration manages the founder's journey through business stages. ML scoring powers the location simulator and revenue forecasting. The agentic chatbot ties everything together through conversation.

**Transition:** "Starting with the RAG pipeline."

---

## SLIDE 6 — Hybrid RAG

**Slide Title:** "3-Way Hybrid Search: Vector + FTS + Trigram"

**Key Visual:**

```
Query
  ↓          ↓           ↓
Vector    Full-Text   Trigram
(cosine)  (ts_rank)  (word_sim)
  ↓          ↓           ↓
      RRF Fusion  k=60
           ↓
     Ranked results + similarity %
```

Embedding: _BGE-M3 1024-dim (local GPU/CPU)_

**Spoken Script:**
Pure vector search underperforms on Korean compound words. The solution is 3-way Reciprocal Rank Fusion in PostgreSQL — vector similarity, full-text search, and pg_trgm trigram matching fused by rank. Embeddings run locally using BGE-M3 with HNSW indexing. Each result returns both an RRF score for ranking and a raw cosine similarity for display.

**Transition:** "The agents that use this retrieval are coordinated by LangGraph."

---

## SLIDE 7 — Multi-Agent Orchestration

**Slide Title:** "LangGraph State Machine: Stage-Driven Agent Routing"

**Key Visual:**

```
Founder Stage:  Setup → Early Ops → Growth
                      ↓
           Sub-stage (9 states)
                      ↓
         route() dispatches to agent:
  Location | Tax | Hiring | Subsidy
```

_State persisted in Supabase per user session_

**Spoken Script:**
LangGraph models the founder's journey as a directed state graph with 9 sub-stages. The route function evaluates the current sub-stage and dispatches to the right agent. Each agent retrieves RAG context, calls Claude Haiku, and returns a structured draft. State is persisted in Supabase so the graph resumes correctly across sessions.

**Transition:** "Here's what each agent actually produces."

---

## SLIDE 8 — Agents

**Slide Title:** "5 Agents — RAG + Claude Haiku + Draft Output"

**Key Visual:**
Simple table:
| Agent | Output |
|-------|--------|
| Tax | Compliance checklist + deadline draft |
| Hiring | Job posting (3 platforms) + labor contract |
| Subsidy | Program match + pre-filled application |
| Location | District scores + risk level |
| Document | Form field extraction from HWP files |

**Spoken Script:**
Every agent follows the same pattern: retrieve relevant context, call Claude Haiku, return a structured draft. The subsidy agent parses HWP5 binary — Korea's proprietary document format — extracts form fields, and pre-fills them from the founder's profile. The hiring agent generates a print-ready HTML job posting formatted for A4.

**Transition:** "The system also acts on its own, through four types of triggers."

---

## SLIDE 9 — Proactive Triggers

**Slide Title:** "4 Trigger Types: The System Acts First"

**Key Visual:**

```
Time-Based     → Daily cron · VAT D-30/14/7/3 alerts
State Change   → Stage advance → notification + draft
Event Detect   → New subsidy crawled → founder matched
LLM Inference  → Claude Haiku judges context
                 {months_open, revenue, has_staff}
                 → {trigger: bool, reason}
```

**Spoken Script:**
Time-based triggers fire daily via APScheduler with deduplication tracked per user and deadline. State-transition triggers fire whenever LangGraph advances a stage. LLM inference is the most interesting: Claude Haiku receives operational context as a JSON object and decides whether a proactive alert is warranted — returning both a decision and its reasoning.

**Transition:** "Location intelligence combines ML with LLM interpretation."

---

## SLIDE 10 — ML Layer

**Slide Title:** "ML: Weighted Scoring Ensemble + Revenue Prediction"

**Key Visual:**

```
Location Simulator          Revenue Forecasting
──────────────────          ───────────────────
Survival rate    35%        RandomForest
Saturation       25%        ← Seoul store stats
Est. revenue     20%          + foot traffic data
Break-even       10%
Growth trend     10%        Coverage: 25 districts
→ Risk: LOW / MED / HIGH
```

**Spoken Script:**
The location simulator uses a weighted ensemble calibrated with Mapo-gu market constants — average rent, startup investment, and foot traffic conversion rates. Each metric is min-max normalized and combined into a total score. A RandomForest revenue predictor trained on Seoul Open Data expanded coverage from Mapo-gu's 9 zones to all 25 Seoul districts.

**Transition:** "The chatbot brings all these systems together in conversation."

---

## SLIDE 11 — Agentic Chatbot

**Slide Title:** "2-Stage Tool Use + SSE Streaming"

**Key Visual:**

```
User message
      ↓
Stage 1: Claude Haiku selects tools
  search_laws · search_subsidies
  get_tax_deadlines · get_location_districts
      ↓
Tools call real backend endpoints
      ↓
Stage 2: Claude Haiku streams answer (SSE)
      ↓
react-markdown · 15-turn session limit
```

**Spoken Script:**
The chatbot uses two-stage Claude Haiku inference. In stage one, the model selects which tools to call — it never answers legal or tax questions from training data alone. Tool calls hit real backend endpoints for live data. In stage two, Claude streams the final answer via Server-Sent Events. A 15-turn session limit controls token cost.

**Transition:** "All of this runs on top of a real data pipeline."

---

## SLIDE 12 — Data Pipeline

**Slide Title:** "8 Crawlers · HWP Parser · 21 DB Migrations"

**Key Visual:**

```
Data Sources          Special Parser
──────────────        ──────────────────────
법제처 Open API       HWP5 Binary Format:
기업마당 BizInfo       OLE container parse
서울 열린데이터        zlib decompress
골목상권 API          record-stream → text
기상청, 공휴일        → form fields for Claude
```

**Spoken Script:**
Eight crawlers pull from Korean government APIs — law text, subsidies, commercial statistics, weather, and holidays. A custom HWP5 parser was necessary because government subsidy forms are distributed in this proprietary binary format with no Python library support. The database has evolved through 21 migrations, incrementally adding vector search, hybrid search, and ML feature tables.

**Transition:** "Here's where the build stands right now."

---

## SLIDE 13 — Current Progress

**Slide Title:** "14 Modules Shipped Across the Full Stack"

**Key Visual:**
Two-column checklist:

```
AI / Backend                  Frontend
─────────────────────         ──────────────────────
✅ RAG pipeline               ✅ Founder onboarding
✅ 3-way hybrid search        ✅ Location analysis UI
✅ LangGraph orchestrator     ✅ Tax deadline dashboard
✅ 5 specialized agents       ✅ Subsidy calendar + drafts
✅ 4 trigger types            ✅ Sales + expense tracking
✅ HWP5 parser                ✅ Menu management + POS import
✅ ML location simulator      ✅ Hiring UI
✅ RandomForest predictor     ✅ Agentic chatbot
```

**Spoken Script:**
Fourteen modules are complete across the full stack. The backend covers the entire AI pipeline — RAG, agents, triggers, ML, and data crawlers. The frontend exposes all major modules as working UI. The system runs end-to-end on live infrastructure with real government data feeding every AI component.

**Transition:** "Here's how we got here and who built it."

---

## SLIDE 14 — Timeline & Collaboration

**Slide Title:** "3 Months · Feature Branch Workflow · AI-Assisted Development"

**Key Visual:**
Horizontal timeline:

```
Feb 2025            Mar 2025            Apr 2025 (now)
    │                   │                   │
Architecture        Data layer          Full stack
Core API            RAG + crawlers      Agents + ML
DB schema           Hybrid search       Chatbot + hiring
                    Location sim        21 migrations done

Process:
  GitHub feature branches  ·  Weekly sprint reviews
  Claude Code as dev assistant  ·  Supabase for infra
```

**Spoken Script:**
Development ran across three phases over roughly three months — architecture and core API, data infrastructure and RAG, then full-stack feature completion. The team uses GitHub with feature branches and weekly sprint reviews. Claude Code has been an active development assistant throughout, accelerating implementation of complex components like the HWP parser and hybrid search SQL functions.

**Transition:** "And here's where the product is headed."

---

## SLIDE 15 — Goals & Roadmap

**Slide Title:** "Goal: 100 Pilot Founders in Mapo-gu → Seoul-Wide F&B"

**Key Visual:**
Three phases:

```
Next Sprint              Q4 Target               Beyond
────────────────         ─────────────────       ──────────────
Real POS integration     Public beta launch      25 Seoul districts
PWA push notifications   100 pilot founders      Bakery + snack bar
Session persistence      Backtest evaluation     B2B platform model
                         Trigger A/B testing
```

**Spoken Script:**
The immediate next step closes the data loop — real POS integration and mobile push notifications. The Q4 target is a public beta with 100 pilot founders in Mapo-gu, with backtest evaluation measuring subsidy recommendation accuracy and trigger timing. The long-term goal is to prove the model in one district and one business type, then expand the pattern to Seoul-wide F&B micro-businesses.

**Transition:** [Open for mentor Q&A]

---

## END OF SCRIPT

**Slides:** 15 · **Runtime:** ~10 min · **Type:** Mid-dev mentor review · **Language:** English

---

### CONTEXT FOR GEMINI

- **LLM:** Claude Haiku (all agents and chatbot)
- **Embeddings:** BAAI/bge-m3 1024D local + OpenAI fallback
- **Hybrid search:** 3-way RRF in PostgreSQL (vector + FTS + trigram), k=60
- **Agents:** 5 specialized via LangGraph StateGraph, 9 sub-stages
- **Triggers:** APScheduler cron, state-transition, event-detection, LLM inference
- **ML:** Weighted scoring ensemble + RandomForest (25 Seoul districts)
- **Data:** 8 crawlers, custom HWP5 binary parser, 21 DB migrations
- **Stack:** FastAPI · Next.js 14 · Supabase pgvector · Vercel
- **Domain:** Seoul Mapo-gu · café · solo founders

_BOSS | Business Operations Support System | Seoul Mapo-gu_

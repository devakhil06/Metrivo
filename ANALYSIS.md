# Metrivo Project Analysis

> **Implementation status (19 August 2026):** The security and chatbot proposal in section I has been superseded by the implemented hardened-SaaS design documented in `SECURITY.md`. Strict zero knowledge remains a separate client-compute architecture project; the obsolete PBKDF2-100k, SSE-C, tab-close logout, and middleware-rotation suggestions below are retained only as historical planning context.

## A. Architecture Summary

```
User → Next.js Frontend (App Router) → API Routes (Auth, Upload, Analytics, Chat)
                                    ↓
                            MongoDB (Mongoose) ←→ Python FastAPI (Analytics/Forecast/Anomalies)
                                    ↓
                            DeepSeek LLM (Tool Calling) → Agent Tools → Analytics Engine
```

**Stack:**
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind
- **Database**: MongoDB (Mongoose in Next.js, pymongo in Python)
- **Analytics Service**: Python FastAPI (numpy/pandas) — runs on port 8000
- **AI Analyst**: DeepSeek `deepseek-chat` with OpenRouter/NVIDIA fallback, tool calling
- **Auth**: 15-minute access JWTs + rotating, hashed 30-day refresh sessions

---

## B. Component Map

| Component | File | Function/Class | Responsibility |
|-----------|------|----------------|----------------|
| **Auth** | `src/lib/auth.ts` | `requireUser()`, `createAuthSession()`, `rotateAuthSession()` | JWT verification, refresh rotation and revocation |
| **Middleware** | `src/middleware.ts` | `middleware()` | Protects routes, redirects unauthenticated users |
| **DB Connection** | `src/lib/db.ts` | `connectDb()` | Mongoose connection pooling |
| **Models** | `src/lib/models.ts` | `User`, `Business`, `Transaction`, `FileModel`, `Conversation`, `Message`, `RefreshSession`, `RateLimit` | Mongoose schemas |
| **Upload** | `src/app/api/upload/route.ts` | `POST()` | Parse CSV/XLSX → classify → dedupe → insert transactions |
| **Python Parse** | `src/lib/python.ts` | `parseCsv()` | Calls Python `/parse` endpoint |
| **Parse (TS)** | `src/lib/parse.ts` | `parseSpreadsheet()` | XLSX fallback parser with column detection |
| **CSV Processor** | `backend/app/csv_processor.py` | `process_csv()` | Pandas chunked CSV parser, auto-detects columns |
| **Classify** | `src/lib/classify.ts` | `classifyTransaction()` | Regex-based category/subcategory classification |
| **Direction** | `src/lib/direction.ts` | `inferDirection()` | Infers credit/debit from description/type/amount |
| **Dedupe** | `src/lib/preprocess.ts` | `dedupKey()` | MD5 hash for deduplication |
| **Analytics (TS)** | `src/lib/analytics.ts` | `monthlyTotals()`, `getOverview()`, `getRisks()`, `getOpportunities()` | MongoDB aggregations for dashboard |
| **Analytics (Py)** | `backend/app/analytics.py` | `compute_analytics()` | Full 9-domain analytics + forecast + anomalies |
| **Forecast** | `backend/app/forecast.py` | `forecast()`, `detect_anomalies()` | Linear/Holt/Holt-Winters + z-score anomalies |
| **API Bridge** | `src/lib/python.ts` | `getAnalytics()`, `analyzeBusiness()` | Calls Python FastAPI |
| **Agent** | `src/lib/agent.ts` | `runAnalyst()` | DeepSeek tool-calling agent with 7 tools |
| **Chat API** | `src/app/api/analyst/chat/route.ts` | `POST()` | Streaming chat with conversation persistence |
| **Reclassify** | `src/lib/reclassify.ts` | `reclassifyBusiness()` | Re-infers direction for all transactions |

---

## C. Workflow Diagram (Mermaid)

```mermaid
flowchart TD
    User[User] --> FE[Next.js Frontend]
    FE --> Auth[Auth Middleware]
    Auth -->|Valid JWT| API[API Routes]
    
    subgraph Upload["File Upload Flow"]
        API --> UploadAPI[POST /api/upload]
        UploadAPI --> ParseTS[parseSpreadsheet TS]
        UploadAPI --> ParsePy[parseCsv Python]
        ParsePy --> PySvc[Python FastAPI /parse]
        PySvc --> CSVProc[csv_processor.py]
        ParseTS --> Classify[classifyTransaction]
        ParsePy --> Classify
        Classify --> Direction[inferDirection]
        Direction --> Dedup[dedupKey]
        Dedup --> MongoDB[(MongoDB Transactions)]
        MongoDB --> Invalidate[invalidateAnalyticsCache]
        Invalidate --> PyAnalyze[analyzeBusiness async]
    end
    
    subgraph Chat["AI Analyst Chat Flow"]
        API --> ChatAPI[POST /api/analyst/chat]
        ChatAPI --> Conv[Conversation/Message]
        Conv --> Agent[runAnalyst]
        Agent --> LLM[DeepSeek LLM]
        LLM -->|Tool Calls| Tools{7 Agent Tools}
        Tools -->|get_overview| AnalyticsTS[analytics.ts]
        Tools -->|get_trends| AnalyticsTS
        Tools -->|get_expense_breakdown| AnalyticsTS
        Tools -->|get_revenue_breakdown| AnalyticsTS
        Tools -->|get_risks| AnalyticsTS
        Tools -->|get_opportunities| AnalyticsTS
        Tools -->|get_business_profile| Business Model
        AnalyticsTS --> MongoDB
        LLM --> Stream[NDJSON Stream]
        Stream --> FE
    end
    
    subgraph Analytics["Analytics Flow"]
        API --> FullAPI[GET/POST /api/analytics/full]
        FullAPI --> PyAnalytics[Python /analytics/{id}]
        PyAnalytics --> Compute[compute_analytics]
        Compute --> Forecast[forecast.py]
        Compute --> Anomalies[detect_anomalies]
        Compute --> Cache[KPIs Collection]
        Cache --> FE
    end
```

---

## D. Routing Flow

### Request Classification
- **Middleware** (`src/middleware.ts:8-30`) intercepts all requests
- Protected paths: `/dashboard`, `/metrics`, `/upload`, `/transactions`, `/chat`, `/onboarding`
- JWT verified via `jose` library; redirects to `/login` if invalid

### API Route Selection
| Route | Handler | Purpose |
|-------|---------|---------|
| `/api/auth/*` | `src/app/api/auth/*/route.ts` | Register, login, logout, me |
| `/api/businesses` | `src/app/api/businesses/route.ts` | CRUD business profile |
| `/api/businesses/inputs` | `src/app/api/businesses/inputs/route.ts` | Update financial inputs |
| `/api/upload` | `src/app/api/upload/route.ts` | File upload & parsing |
| `/api/files` | `src/app/api/files/route.ts` | List/delete uploaded files |
| `/api/transactions` | `src/app/api/transactions/route.ts` | List/delete transactions |
| `/api/transactions/reclassify` | `src/app/api/transactions/reclassify/route.ts` | Re-infer directions |
| `/api/analytics/overview` | `src/app/api/analytics/overview/route.ts` | Dashboard KPIs + risks/opportunities |
| `/api/analytics/trends` | `src/app/api/analytics/trends/route.ts` | Monthly trends (12 months) |
| `/api/analytics/breakdown` | `src/app/api/analytics/breakdown/route.ts` | Category breakdown |
| `/api/analytics/full` | `src/app/api/analytics/full/route.ts` | Full analytics (calls Python) |
| `/api/analyst/chat` | `src/app/api/analyst/chat/route.ts` | Streaming AI chat |
| `/api/conversations` | `src/app/api/conversations/route.ts` | List/create/delete conversations |

### Workflow Selection
- **Upload**: CSV → Python pandas (preferred) → fallback to TS `xlsx` parser
- **Analytics**: 
  - Dashboard: TS aggregations (`analytics.ts`) for speed
  - Full metrics: Python `compute_analytics()` (9 domains + forecast + anomalies)
- **Chat**: DeepSeek with **7 fixed tools** (rule-based tool selection by LLM)

### Agent/Tool Selection
- **Hardcoded 7 tools** in `src/lib/agent.ts:77-132`
- LLM decides which tools to call via function calling
- No dynamic agent routing — single "Analyst" agent
- Tools execute sequentially (max 6 iterations in `runAnalyst` loop)

### Parallel Execution
- **No parallel agent execution** — single agent per chat
- Some `Promise.all` in API routes (e.g., overview + risks + opportunities)
- Python analytics computes all domains sequentially

---

## E. Agent Communication Diagram

```mermaid
flowchart LR
    User --> ChatUI[Chat Page]
    ChatUI --> ChatAPI[/api/analyst/chat]
    ChatAPI --> Agent[runAnalyst]
    
    Agent --> LLM[DeepSeek LLM]
    LLM -.->|Function Calling| Tools
    
    subgraph Tools["Agent Tools (7)"]
        T1[get_overview]
        T2[get_trends]
        T3[get_expense_breakdown]
        T4[get_revenue_breakdown]
        T5[get_risks]
        T6[get_opportunities]
        T7[get_business_profile]
    end
    
    T1 --> AnalyticsTS[analytics.ts]
    T2 --> AnalyticsTS
    T3 --> AnalyticsTS
    T4 --> AnalyticsTS
    T5 --> AnalyticsTS
    T6 --> AnalyticsTS
    T7 --> Business[Business Model]
    
    AnalyticsTS --> MongoDB[(MongoDB)]
    Business --> MongoDB
    
    MongoDB --> AnalyticsTS
    AnalyticsTS --> Tools
    Tools --> LLM
    LLM -->|Stream| ChatAPI
    ChatAPI -->|NDJSON| ChatUI
```

**Communication Mechanisms:**
| Mechanism | Used For |
|-----------|----------|
| **Direct function calls** | Agent → Tools (in-process TypeScript) |
| **Shared MongoDB** | All services read/write transactions, businesses, conversations |
| **HTTP API** | Next.js → Python FastAPI (analytics, parse, forecast) |
| **WebSocket-like** | NDJSON streaming (`ReadableStream`) for chat |
| **In-memory** | Conversation history (last 12 messages) passed to LLM |

---

## F. State Flow

| State Type | Storage | Flow |
|------------|---------|------|
| **Workflow State** | None (stateless API) | Each request independent |
| **Agent State** | In-memory (per request) | `runAnalyst` loop: messages array + tool calls (max 6 iterations) |
| **Persistent DB State** | MongoDB collections: `users`, `businesses`, `transactions`, `files`, `conversations`, `messages`, `kpis` | All services read/write |
| **Conversation Memory** | `conversations` + `messages` collections | Last 12 messages loaded per chat |
| **Vector/RAG Memory** | ❌ Not implemented | No embeddings, no vector DB |
| **Cache/Queue State** | `kpis` collection (analytics cache) | `invalidateAnalyticsCache()` deletes on upload/reclassify; Python upserts on `/analyze` |

**State Transitions:**
```
Upload → Transactions inserted → kpis deleted → Python analyzeBusiness() async → kpis upserted
Chat → Conversation created/loaded → Messages appended → Stream response → Assistant message saved
Reclassify → Transactions updated → kpis deleted → Python analyzeBusiness() async
```

---

## G. Implementation Status

| Feature | Status | Evidence |
|---------|--------|----------|
| User Auth (JWT) | ✅ Implemented | `src/lib/auth.ts`, `src/middleware.ts` |
| Business Onboarding | ✅ Implemented | `/api/businesses` CRUD |
| File Upload (CSV/XLSX) | ✅ Implemented | `/api/upload`, `parse.ts`, `csv_processor.py` |
| Column Auto-detection | ✅ Implemented | `csv_processor.py:55-73`, `parse.ts:158-187` |
| Direction Inference | ✅ Implemented | `direction.ts`, `csv_processor.py:116-139` |
| Category Classification | ✅ Implemented | `classify.ts:7-53` |
| Deduplication | ✅ Implemented | `preprocess.ts:33-47`, `upload/route.ts:85-160` |
| Dashboard Analytics | ✅ Implemented | `analytics.ts`, `/api/analytics/overview` |
| Full 9-Domain Analytics | ✅ Implemented | `backend/app/analytics.py:105-279` |
| Forecasting (3 methods) | ✅ Implemented | `backend/app/forecast.py:8-68` |
| Anomaly Detection | ✅ Implemented | `backend/app/forecast.py:71-94` |
| AI Analyst Chat | ✅ Implemented | `agent.ts:174-296`, `/api/analyst/chat` |
| Tool Calling (7 tools) | ✅ Implemented | `agent.ts:77-132` |
| Streaming Response | ✅ Implemented | `agent.ts:257-271`, `chat/page.tsx:134-158` |
| Conversation History | ✅ Implemented | `/api/conversations`, `models.ts:125-160` |
| Financial Inputs | ✅ Implemented | `/api/businesses/inputs`, `models.ts:32` |
| Reclassify Directions | ✅ Implemented | `reclassify.ts`, `/api/transactions/reclassify` |
| File Deletion | ✅ Implemented | `/api/files/[id]`, `/api/transactions` DELETE |
| Vector/RAG | ❌ Missing | No embeddings, no vector search |
| Multi-agent Orchestration | ❌ Missing | Single agent only |
| Workflow Engine | ❌ Missing | No DAG, no task dependencies |
| HITL/Approval | ❌ Missing | No pause/resume, no approval gates |
| Queue/Worker | ❌ Missing | Async via `catch(() => {})` fire-and-forget |
| Retry/Error Handling | ⚠️ Partial | Basic try/catch, no exponential backoff |
| Rate Limiting | ❌ Missing | No rate limiting on API |

---

## H. Critical Issues (Top 5)

### 1. **No Workflow/Orchestration Engine**
- **Evidence**: No workflow definitions, no task DAG, no state machine. Each API route is independent.
- **Impact**: Cannot model multi-step processes (e.g., "upload → parse → classify → review → approve → analyze").
- **Files**: All API routes are standalone; no orchestrator exists.

### 2. **Fire-and-Forget Async Processing**
- **Evidence**: `upload/route.ts:199` — `analyzeBusiness(businessId).catch(() => {})` swallows errors silently.
- **Impact**: Analytics recomputation failures are invisible; no retry, no monitoring.
- **Files**: `src/app/api/upload/route.ts:199`, `src/app/api/transactions/reclassify/route.ts:18`

### 3. **Single Agent, No Multi-Agent Support**
- **Evidence**: `agent.ts` exports only `runAnalyst`; tools hardcoded; no agent registry, no delegation.
- **Impact**: Cannot decompose complex queries (e.g., "forecast + risk analysis + benchmark").
- **Files**: `src/lib/agent.ts:174-296`

### 4. **No Vector Search / RAG**
- **Evidence**: No embedding generation, no vector DB, no semantic search in codebase.
- **Impact**: Agent cannot retrieve relevant historical context beyond last 12 messages.
- **Files**: `src/lib/agent.ts:201-205` only loads 12 messages from MongoDB.

### 5. **Python Service Tight Coupling & No Health Checks**
- **Evidence**: `python.ts:3` hardcodes `localhost:8000`; `getAnalytics` returns `null` on failure silently.
- **Impact**: If Python service down, analytics fail silently; no circuit breaker, no fallback to TS analytics.
- **Files**: `src/lib/python.ts:5-17`, `src/app/api/analytics/full/route.ts:19-22`

---

## Summary

**Metrivo is a well-built single-user financial analytics app with an AI chat analyst**, but **it is not an agent orchestration platform**. It has:

- ✅ Solid data pipeline (upload → parse → classify → dedupe → store)
- ✅ Dual analytics engines (TS for dashboards, Python for heavy lifting)
- ✅ Evidence-grounded AI analyst with tool calling
- ❌ No workflow engine, no multi-agent, no RAG, no queue, no HITL

The architecture is **request-response + fire-and-forget async**, not **orchestrated workflows**.

---

## I. Implementation Plan: Enhanced Chatbot UX + Zero-Knowledge Security

> Historical proposal only. See `SECURITY.md` and the README security section for the implemented design and current production boundary.

### 1. Chatbot UX Improvements (Cool, Concise, Feature-Forward)

| Task | Files to Modify | Approach |
|------|----------------|----------|
| **Welcome/Feature Intro** | `src/app/(app)/chat/page.tsx` | Add an onboarding overlay on first visit showing: "💡 I can analyze revenue, expenses, profit, cash flow, risks & opportunities — just ask!" with example prompts as clickable chips |
| **Concise System Prompt** | `src/lib/agent.ts:49-61` | Shorten system prompt: "You're Metrivo, a concise business analyst. Answer in 2-4 sentences max. Lead with numbers. End with 1 actionable step." |
| **Streaming Response Polish** | `src/app/(app)/chat/page.tsx:148-155` | Reduce chunk buffer (40→20 chars), add subtle typing indicator, remove redundant "Thinking…" status |
| **Smart Empty State** | `src/app/(app)/chat/page.tsx:213-216` | Replace "Ask a question" with rotating example prompts: "What's my profit margin?", "Top 3 expenses?", "Any risks this month?" |

### 2. Zero-Knowledge / End-to-End Security (Confidential Data Protection)

| Layer | Implementation | Files |
|-------|----------------|-------|
| **Encryption at Rest** | Client-side encryption (Web Crypto API) before upload; server only stores ciphertext + IV. Key derived from user password via PBKDF2 (never sent to server). | New: `src/lib/crypto.ts`, modify `src/app/api/upload/route.ts`, `src/lib/parse.ts` |
| **Zero-Knowledge Architecture** | Server cannot decrypt transactions/conversations. All analytics computed on encrypted data via homomorphic techniques OR move analytics to client (WebAssembly) | Major refactor — recommend phased: Phase 1: Encrypt sensitive fields (amount, description, merchant) |
| **Conversation Encryption** | Encrypt message content client-side before POST to `/api/analyst/chat` | Modify `src/app/(app)/chat/page.tsx:123-128`, `src/app/api/analyst/chat/route.ts` |
| **Key Management** | User password → PBKDF2 (100k iterations) → encryption key. Store only salt + hash in DB. Key never leaves browser. | New: `src/lib/encryption.ts`, extend `User` model in `models.ts` |

### 3. File Upload Security (No Public Directory Exposure)

| Issue | Fix |
|-------|-----|
| **Current**: Files uploaded to server filesystem / MongoDB GridFS | **Fix**: Stream directly to encrypted blob storage (S3-compatible with SSE-C) or keep in MongoDB with client-side encryption. Never write to `public/`. |
| **Temp files** | Ensure `upload/` route uses in-memory buffers (`Buffer.from()`) not disk writes. Verify `src/app/api/upload/route.ts` doesn't use `fs.writeFile`. |

### 4. Auto-Logout on Tab Close / Session Expiry

| Mechanism | Implementation |
|-----------|----------------|
| **Short-lived Access Tokens** | Reduce JWT expiry from `7d` → `15m` (`src/lib/auth.ts:16`) |
| **Refresh Tokens** | Add httpOnly `refreshToken` cookie (30d expiry, rotation on use). Store hashed refresh tokens in DB. | 
| **BeforeUnload Logout** | Add `window.addEventListener('beforeunload', () => fetch('/api/auth/logout', {method:'POST', keepalive:true}))` in `chat/page.tsx` and root layout |
| **Tab Close Detection** | Use `visibilitychange` + `beforeunload` to trigger logout API with `keepalive: true` |
| **Middleware Update** | Check refresh token validity; auto-rotate on each request |

### 5. Chatbot Efficiency Optimizations

| Area | Recommendation |
|------|----------------|
| **Token Usage** | Compress history: summarize last 6 messages server-side instead of sending full history. Add `summarizeHistory()` in `agent.ts`. |
| **Tool Call Batching** | Allow multiple tool calls per turn (already supported), but add parallel execution via `Promise.all()` in `runAnalyst()` loop |
| **Caching** | Cache `getOverview`, `getRisks`, `getOpportunities` for 30s per business in Redis/in-memory LRU (`src/lib/analytics.ts`) |
| **Model Selection** | Use smaller model (`deepseek-chat` vs `llama-70b`) for simple queries; route complex ones to larger model |
| **Streaming Chunk Size** | Increase delta chunk from 40→80 chars to reduce render cycles |
| **Fallback Path** | Skip LLM entirely for "overview/summary" questions — use deterministic `fallbackAnswer()` directly (already exists, just expose via tool) |

---

### Phased Implementation Order

| Phase | Scope | Est. Effort |
|-------|-------|-------------|
| **1** | Chat UX: welcome intro, concise prompt, empty state prompts | 2-3 hrs |
| **2** | Auth hardening: short JWT (15m) + refresh tokens + auto-logout | 4-6 hrs |
| **3** | Client-side encryption for uploads + conversations (zero-knowledge v1) | 8-12 hrs |
| **4** | Full zero-knowledge analytics (WebAssembly / homomorphic) | Major — separate project |
| **5** | Chatbot efficiency: history summarization, caching, model routing | 3-5 hrs |

---

### Clarifying Questions for Implementation

1. **Zero-knowledge scope**: Encrypt only *new* uploads/conversations, or migrate existing data too?
2. **Analytics location**: Move analytics computation to client (WebAssembly) or keep server-side with encrypted data (requires homomorphic encryption / MPC)?
3. **Refresh token storage**: MongoDB (current) or Redis for faster rotation?
4. **Chat welcome**: Show feature intro *every* session or only first visit (localStorage flag)?

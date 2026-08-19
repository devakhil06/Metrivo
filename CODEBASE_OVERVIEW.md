# Metrivo Codebase Overview

## Purpose

Metrivo is a business-finance intelligence application for small businesses. Users create a business profile, upload bank or payment transaction statements, and receive dashboards, detailed metrics, forecasts, anomaly signals, and an evidence-grounded analyst chat experience.

The system separates request handling and interactive UI concerns from heavier analytics work. Next.js owns the web application, authentication, API boundary, transaction storage, and fast dashboard aggregations. A private Python service parses large CSV files and computes comprehensive analytics and forecasts.

## Technology stack

| Area | Technology |
| --- | --- |
| Web application | Next.js 14 App Router, React 18, TypeScript |
| Styling and UI | Tailwind CSS, CSS modules, Recharts |
| Data store | MongoDB, accessed with Mongoose from TypeScript and PyMongo from Python |
| Analytics service | Python 3, FastAPI, Uvicorn, Pandas, NumPy |
| AI analyst | OpenAI-compatible chat client with DeepSeek, OpenRouter, or NVIDIA-compatible provider configuration |
| Authentication | JWT access tokens and rotating refresh sessions in HTTP-only cookies |
| Local infrastructure | Docker Compose for MongoDB |

## Main components

### Next.js application (`src/`)

- `src/app/page.tsx` is the public landing page.
- `src/app/login` and `src/app/register` provide authentication entry points.
- `src/app/(app)/` contains the authenticated application shell and user-facing workflows:
  - `dashboard` presents KPI cards, trends, category breakdowns, forecasts, risks, and opportunities.
  - `metrics` presents the broader financial, sales, customer, marketing, operations, growth, trend, forecast, and anomaly views.
  - `upload` accepts transaction files and shows import quality information.
  - `transactions` provides transaction browsing, deletion, and reclassification actions.
  - `chat` provides the analyst conversation interface.
  - `onboarding` collects the business profile and optional metric inputs.
- `src/components/` contains reusable UI elements such as navigation, KPI cards, charts, month controls, forms, and confirmation dialogs.
- `src/lib/` contains server and client business logic:
  - `models.ts` defines MongoDB models for users, businesses, files, transactions, conversations, messages, refresh sessions, and rate limits.
  - `parse.ts`, `classify.ts`, `direction.ts`, and `preprocess.ts` normalize uploaded rows, infer transaction direction, assign categories, and generate deduplication keys.
  - `analytics.ts` provides fast MongoDB-backed overview, trend, breakdown, risk, and opportunity calculations.
  - `python.ts` is the typed client for the Python analytics service.
  - `agent.ts` implements the analyst orchestration, tool definitions, provider selection, streaming events, and deterministic fallback responses.
  - `auth.ts`, `session-config.ts`, `security.ts`, and `rate-limit.ts` implement authentication and request protection.
- `src/middleware.ts` protects authenticated routes, validates access tokens, redirects unauthenticated users, and applies origin checks to API mutations.

### Next.js API routes (`src/app/api/`)

The API layer is grouped by responsibility:

- `auth/` handles registration, login, logout, access-token refresh, and the current-user endpoint.
- `businesses/` manages business profiles and optional analytics inputs.
- `upload/` validates files, delegates CSV parsing to Python when available, falls back to TypeScript parsing, classifies rows, removes duplicates, stores transactions, invalidates cached analytics, and triggers analysis.
- `transactions/` supports transaction retrieval, deletion, and bulk direction reclassification.
- `files/` manages uploaded-file metadata and file deletion cascades.
- `analytics/` exposes fast overview, trend, and breakdown responses plus the full Python analytics document.
- `analyst/chat/` streams analyst status, tool activity, response deltas, completion, and error events while persisting conversation messages.
- `conversations/` manages saved analyst conversations and their messages.

All business-scoped routes resolve the authenticated user's business before reading or writing data.

### Python analytics service (`backend/app/`)

- `main.py` exposes the private FastAPI endpoints:
  - `POST /parse` for CSV structure detection and chunked parsing.
  - `GET /analytics/{business_id}` for cached or on-demand analytics.
  - `POST /analyze/{business_id}` to recompute and persist analytics.
  - `GET /forecast/{business_id}` and `GET /anomalies/{business_id}` for focused results.
- `csv_processor.py` uses Pandas chunking, column-role detection, date and amount normalization, and rule-based direction inference. It returns parsed transactions, detected structure, import summaries, and skipped-row counts.
- `analytics.py` aggregates monthly financial data and produces the multi-domain analytics document. It calculates revenue, expense, profit, margins, cash flow, fixed and variable expenses, ratios, sales/customer/marketing/operations/growth/trend outputs, and data-quality indicators.
- `forecast.py` provides linear, Holt, and Holt-Winters forecasting, confidence bands, and statistical anomaly detection.
- `db.py` contains the Python-side MongoDB connection and business/analytics collection helpers.

The service is intended to be private. In production, Next.js and FastAPI share `ANALYTICS_SERVICE_TOKEN`; browser clients never call the Python service directly.

## How the components interact

### Upload and preprocessing flow

1. The browser sends a CSV, XLSX, or XLS file to the Next.js upload route.
2. The route validates size, extension, and file signatures.
3. CSV files are sent to Python for memory-efficient Pandas parsing. Spreadsheet files, or CSVs when Python is unavailable, use the TypeScript `xlsx` parser.
4. Each row is normalized, assigned a credit/debit direction, classified into categories and subcategories, and given a business-scoped deduplication key.
5. Existing transactions are compared by normalized content. Exact duplicates are skipped; direction changes can repair an existing record.
6. New transactions and uploaded-file metadata are stored in MongoDB.
7. Analytics cache state is invalidated, and a background request asks Python to recompute the full analytics document.

### Dashboard and metrics flow

The dashboard uses lightweight TypeScript/MongoDB aggregations for responsive KPI and trend views. The metrics page requests the full Python analytics document for deeper domain calculations. Reusable Recharts components turn the returned series and breakdowns into visualizations.

### Analyst flow

1. The chat route loads the authenticated business, conversation history, and recent messages.
2. `agent.ts` selects the configured DeepSeek/OpenRouter/NVIDIA-compatible provider.
3. The model can call deterministic tools for overview, trends, revenue and expense breakdowns, risks, opportunities, and business profile data.
4. Tool results are returned to the model, which streams a concise answer back to the browser.
5. User and assistant messages are persisted in MongoDB.
6. If no AI key is configured, or a snapshot question can be answered deterministically, Metrivo returns a local data summary instead.

## Data model and security boundaries

MongoDB stores user accounts, one business profile per owner, uploaded-file metadata, normalized transactions, analytics documents, conversations, messages, refresh sessions, and distributed rate-limit counters. Raw uploads are processed in memory and are not published as static files.

Authentication uses short-lived access JWTs and rotating refresh sessions. Middleware and API helpers enforce business ownership, while origin checks, rate limits, secure cookie settings, and security headers protect state-changing requests. The Python service has its own bearer credential and does not enable browser CORS.

## Operational entry points

```text
npm run dev          Start the Next.js development server on port 3000
npm run analytics    Start the FastAPI analytics service on port 8000
npm run build        Create a production Next.js build
npm run start        Start the production Next.js server
npm run typecheck    Run the TypeScript compiler without emitting files
npm run test:python  Run the Python service tests
npm run seed         Load optional demo data
npm run reclassify   Re-run transaction direction classification
```

MongoDB can be started locally with `docker compose up -d mongo`. Runtime configuration is supplied through environment variables such as `MONGODB_URI`, `JWT_SECRET`, `PYTHON_API_URL`, `ANALYTICS_SERVICE_TOKEN`, and the selected AI provider credentials.


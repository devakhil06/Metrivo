# Metrivo

<p align="center">
  <img src="./public/og.png" alt="Metrivo — see the story inside your numbers" width="100%" />
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="./CODEBASE_OVERVIEW.md">Architecture</a> ·
  <a href="#the-analyst">The Analyst</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

## Platform at a glance

```mermaid
flowchart LR
    A[Bank / UPI / Excel] --> B[Smart ingestion]
    B --> C[Normalize + classify]
    C --> D[Deduplicate]
    D --> E[(MongoDB)]
    E --> F[Dashboard]
    E --> G[Deep metrics]
    E --> H[AI Analyst]
    G --> I[Forecasts + anomalies]
    H --> J[Decisions]
    style A fill:#14251b,stroke:#9bff76,color:#fff
    style E fill:#102018,stroke:#5af0da,color:#fff
    style J fill:#9bff76,stroke:#9bff76,color:#07100c
```

## The Analyst

The Analyst is a data-grounded business assistant—not a free-form chatbot.

```mermaid
flowchart TD
    Q[Business question] --> T{Choose data tool}
    T --> O[Overview]
    T --> R[Revenue breakdown]
    T --> X[Expense breakdown]
    T --> V[Trends]
    T --> K[Risks + opportunities]
    O --> L[Verified tool result]
    R --> L
    X --> L
    V --> L
    K --> L
    L --> A[Concise streamed answer]
    A --> S[Saved conversation]
```

## Technology

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-111111?style=for-the-badge&logo=nextdotjs&logoColor=FFFFFF" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-111827?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-1E293B?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=06B6D4" alt="Tailwind CSS" />
</p>

<p align="left">
  <img src="https://img.shields.io/badge/Recharts-18181B?style=for-the-badge&logo=chartdotjs&logoColor=22B573" alt="Recharts" />
  <img src="https://img.shields.io/badge/MongoDB-17221B?style=for-the-badge&logo=mongodb&logoColor=47A248" alt="MongoDB" />
  <img src="https://img.shields.io/badge/NVIDIA-172015?style=for-the-badge&logo=nvidia&logoColor=76B900" alt="NVIDIA" />
  <img src="https://img.shields.io/badge/JWT-18181B?style=for-the-badge&logo=jsonwebtokens&logoColor=D63AFF" alt="JWT" />
</p>

---


## Quick start

```bash
npm install

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..

cp .env.example .env
docker compose up -d mongo
```

Run the services in separate terminals:

```bash
npm run analytics   # FastAPI :8000
npm run dev         # Next.js :3000
```

Then open [http://localhost:3000](http://localhost:3000).

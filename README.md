<h1 align="center">Metrivo</h1>

<p align="center">
  <img src="./public/og.png" alt="Metrivo — see the story inside your numbers" width="100%" />
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="./CODEBASE_OVERVIEW.md">Architecture</a> ·
  <a href="#the-analyst--query-bot">The Analyst</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

<h2 align="center">Platform at a Glance</h2>

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

<h2 align="center" id="the-analyst--query-bot">The Analyst / Query Bot</h2>

<p align="center">
  The Analyst is a data-grounded business assistant — not a free-form chatbot.
</p>

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

<h2 align="center">Tech Stack</h2>

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg" width="42" height="42" alt="Next.js" />
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" width="42" height="42" alt="React" />
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" width="42" height="42" alt="TypeScript" />
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg" width="42" height="42" alt="Tailwind CSS" />
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/plotly/plotly-original.svg" width="42" height="42" alt="Plotly" />
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg" width="42" height="42" alt="MongoDB" />
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/nvidia/76B900" width="42" height="42" alt="NVIDIA" />
  &nbsp;&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/jsonwebtokens/FB015B" width="42" height="42" alt="JWT" />
</p>

---

<h2 align="center" id="quick-start">Quick Start</h2>

<p align="center">
  Download or clone all project files before starting.
</p>

```bash
npm install

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..

cp .env.example .env
docker compose up -d mongo
```

<h3 align="center">Run the Services</h3>

Run the following commands in separate terminals:

```bash
npm run analytics
```

```bash
npm run dev
```

<p align="center">
  Then open
  <a href="http://localhost:3000">
    <strong>http://localhost:3000</strong>
  </a>
</p>

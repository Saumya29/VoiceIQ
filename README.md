# VoiceIQ

A tool for testing and improving HighLevel Voice AI agent prompts. Instead of manually calling your agent and hoping it works, VoiceIQ lets you generate test scenarios, run simulated conversations, see what's failing, and get an optimized prompt you can push back to HighLevel with one click.

## Quick Start

```bash
git clone <repo-url> && cd VoiceIQ
npm install
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm run dev
```

Open `http://localhost:5173/?locationId=demo` to try it with the built-in demo agents.

## What it does

1. **Analyze** - Reads your agent's system prompt and breaks down what it's trying to do
2. **Generate tests** - Creates test scenarios across happy path, edge cases, and adversarial situations. You can edit them before running
3. **Run tests** - Simulates multi-turn phone conversations using GPT-4o (agent) vs GPT-4o-mini (caller). Results stream in live via SSE
4. **Score results** - Each test gets a pass/partial/fail verdict based on criteria like "did the agent collect the caller's email?"
5. **Optimize** - Takes the failures, figures out what went wrong, and rewrites the prompt. Shows you a side-by-side diff so you know exactly what changed
6. **Apply & re-test** - Push the new prompt to HighLevel, then re-run the same tests to see a before/after comparison

The whole thing loops. Keep iterating until your agent handles everything you throw at it.

## HighLevel Integration

If you want to connect to real HighLevel agents instead of the demo ones:

1. Create a Marketplace App with `voice-ai-agents.readonly` and `voice-ai-agents.write` scopes
2. Set redirect URI to `http://localhost:3001/auth/callback`
3. Add `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_INSTALL_URL` to `.env`
4. Hit the install URL, authorize, then open `http://localhost:5173/?locationId=<your-location-id>`

## How the simulation works

Each test case runs a back-and-forth conversation:

- **Agent side**: GPT-4o at low temperature (0.3) with the agent's real system prompt
- **Caller side**: GPT-4o-mini at high temperature (0.9) with instructions to NOT be cooperative - they'll hesitate, go off-topic, get rude, etc.
- **Evaluator**: GPT-4o at temperature 0, scoring each success criterion

Using different models for agent vs caller avoids the problem where the same model just agrees with itself. The caller actually pushes back.

## Widget

There's a small injectable script for embedding VoiceIQ inside HighLevel's UI:

```bash
npm run build --workspace=widget
```

Produces `widget/dist/voiceiq-widget.js` (6KB). Drop it into any page:

```html
<script>window.VOICEIQ_APP_URL = 'https://your-instance.com';</script>
<script src="voiceiq-widget.js"></script>
```

Shows a floating button that opens VoiceIQ in a slide-in panel. Has fullscreen mode for the results/diff views that need more space.

## Tech

- **Backend**: Express, SQLite (better-sqlite3), OpenAI API
- **Frontend**: Vue 3, Vite
- **Real-time**: SSE for streaming test results as they complete
- **Persistence**: Each test result saves immediately so runs can resume if the server restarts

For production you'd swap SQLite for PostgreSQL and add Redis for SSE fanout.

## API

**Auth**: `GET /auth/install`, `GET /auth/callback`, `GET /auth/status`

**Agents**: `GET /api/v1/agents`, `GET /api/v1/agents/:id`, `GET /api/v1/agents/:id/analysis`

**Tests**: `POST /api/v1/tests/generate`, `GET /api/v1/tests/runs`, `GET /api/v1/tests/runs/:id`, `PUT /api/v1/tests/cases/:id`, `POST /api/v1/tests/runs/:id/execute`, `GET /api/v1/tests/runs/:id/stream`, `POST /api/v1/tests/runs/:id/retest`

**Optimizations**: `POST /api/v1/optimizations/generate`, `GET /api/v1/optimizations/:id`, `POST /api/v1/optimizations/:id/approve`, `POST /api/v1/optimizations/:id/apply`, `POST /api/v1/optimizations/:id/reject`

## Project Layout

```
server/src/
├── agents/          # Agent listing, analysis, demo data
├── auth/            # HighLevel OAuth
├── config/          # DB schema, env config
├── optimizations/   # Prompt optimization
├── services/        # OpenAI client, HighLevel API client
└── tests/           # Test generation, execution, evaluation, SSE

client/src/
├── router/
└── views/           # Dashboard, AgentDetail, TestRunner, TestResults, Optimization
```

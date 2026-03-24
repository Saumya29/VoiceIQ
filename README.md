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

## Beyond pass/fail

A few things on top of the basic test-and-optimize loop:

- **Response conciseness scoring** - Voice agents need to be brief. Long responses are painful on a phone call. After each test, we measure word counts per agent turn and flag anything over 80 words (~30 seconds of speech). This runs as a deterministic check, no LLM cost.
- **Actionable failure messages** - When a test criterion fails, the evaluator doesn't just say "failed". It gives a specific suggestion for how to fix the system prompt. Something like "Add a step to confirm the caller's email before ending the call" instead of just "did not collect email".
- **Deployment confidence score** - When you re-test after an optimization, the results page shows a HIGH / MEDIUM / LOW confidence indicator. It checks for regressions (tests that were passing before but fail now) and tells you whether it's safe to push to production.

## What's real vs what's simulated

- **Real**: HighLevel OAuth, agent CRUD via Voice AI API, pushing optimized prompts back to HighLevel, widget injection
- **Simulated**: Voice conversations are text-based (GPT-4o playing the agent role, GPT-4o-mini playing the caller). No actual phone calls are made. This is intentional - it isolates prompt quality from voice infrastructure and makes tests reproducible

The demo agents work without any HighLevel account. Connect OAuth to test against your real agents.

## Team of One

Built this solo, wearing all the hats:

- **Product**: Scoped the validation flywheel loop (analyze -> test -> optimize -> re-test) as the core workflow. Prioritized the closed-loop experience over breadth of features
- **Design**: Kept the UI minimal and task-oriented. No component library - just clean CSS that roughly matches HighLevel's look. The widget uses a slide-in panel so it doesn't take over the page
- **Engineering**: Plain JS monorepo with npm workspaces. SQLite for zero-config setup, SSE for real-time updates, domain-based folder structure. Used different models and temperatures for agent vs caller to avoid self-correlation in simulations
- **QA**: Stress-tested the codebase for race conditions, crash recovery, data integrity issues, and navigation bugs. Test execution is resumable if the server restarts mid-run

## What I'd build next

Things I thought about but didn't build (yet), roughly in order of impact:

1. **Parallel test execution** - Right now tests run one at a time. Running them concurrently with a configurable concurrency limit (say 3-5) would cut execution time significantly. Would need a semaphore or worker pool pattern.
2. **Score timeline chart** - A sparkline or line chart showing how an agent's score changes across test runs over time. Makes the improvement trend visible at a glance.
3. **Deterministic assertions** - Some checks don't need an LLM. Things like "response must mention the word 'email'" or "agent must not say 'I don't know'" can be regex or string checks. Faster, cheaper, and more reliable than asking GPT to judge.
4. **Failure clustering** - Group similar failures together automatically. If 5 tests all fail because the agent forgets to collect an email, show that as one pattern instead of 5 separate failures. Helps prioritize what to fix.
5. **Conversation replay stepper** - A step-through UI for conversations where you can click through each turn and see annotations about what went wrong at each point. More useful than reading a wall of text.
6. **Prompt version history** - Track every version of the system prompt with timestamps and diffs. Right now you can only see current vs optimized, but if you've done 5 rounds of optimization you lose the history.
7. **Static prompt linting** - Catch common prompt mistakes without running any tests. Things like missing error handling instructions, no escalation path, contradictory rules. Fast feedback before you even run the simulation.
8. **Invariance / consistency testing** - Run the same test case multiple times and check if the agent gives consistent responses. High variance means the prompt isn't constraining behavior enough.
9. **Voice-specific tests** - Simulate interruptions mid-sentence, awkward silences, and background noise scenarios. These are uniquely important for phone-based agents and don't apply to chatbots.

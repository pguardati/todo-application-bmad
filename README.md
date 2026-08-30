# bmad-todo-application-typescript

A personal todo board: a FastAPI + SQLModel backend and a React + Vite client, wired through a
same-origin `/api` seam.

## Prerequisites

| Tool                             | Version | Needed for                                                                            |
|----------------------------------|---------|---------------------------------------------------------------------------------------|
| [uv](https://docs.astral.sh/uv/) | 0.12.x  | Backend dependencies and the pinned Python 3.13 (`make install`, `make test-backend`) |
| Node.js                          | 24 LTS  | Frontend and Playwright (`make install`, `make test-frontend`, `make dev`)            |
| GNU Make                         | 4.x     | Every entrypoint in this repo                                                         |
| Docker with Compose v2           | —       | `make up`, `make test-e2e`, `make ci`                                                 |

`make install` fails without all four.

## Run

Run the built application in Docker:

```sh
make up
```

Open <http://localhost:8080>. Nginx serves the frontend and proxies `/api/*` to the backend.

## Develop

Run the backend and the frontend development servers:

```sh
make install
make test-backend
make test-frontend
make test-e2e
```

## Containers

One `docker-compose.yml` with two profiles:

- `dev` — built images, nginx on 8080 proxying `/api`, SQLite on the `todo-data` named volume.
- `test` — built images, nginx on 8080 proxying `/api`, SQLite on tmpfs. `make test-e2e`.

## Per-story QA

Every story closes with an agentic QA report in `qa/story-1.<M>.md` covering performance,
coverage, accessibility, security, and functional-in-real-Chrome, each with a verdict and
evidence. A story is not done without it, alongside a green `make ci`.

## Configuration

Every backend setting lives in `backend/app/config.py` and has a working local default. Copy
`.env.example` to `.env` **at the repository root** — that is the path `Settings` reads — to
override. `.env` is git-ignored; `.env.example` carries placeholders only.

## AI Integration Log

### Agent Usage

**Which tasks were completed with AI assistance?**

- Creation of the PRD
- Creation of UX artifacts
- Creation of architectural documentation
- Creation of epics
- Sprint Planning
- Building out each story
- Sprint retrospective documentation

**Manual intervention:**

- Each step's orchestration (moving from one artifact or phase to the next, creating PRs, and managing
  iteration—especially for architecture and epics) was managed manually, rather than automatically chaining skills via
  the agent.
- Iterative refinement was especially needed for architecture and epic phases to better fit project needs.

**What prompts worked best?**

- PRD and UX generation tasks were handled smoothly with standard BMAD workflows.
- Architecture and epic creation required several prompt iterations. Architecture modeling required adjusting the
  agent/model to avoid overbuilding during the architecture phase (larger models tended to write too much code too
  early).
- Epic creation needed specific prompts to ensure test cases below the acceptance criteria were also defined. BMAD was
  not generating them reliably by default.

### MCP Server Usage

**Which MCP servers did you use? How did they help?**  
Primarily the Chrome MCP server was used.

- For backend checks, the agent was able to interact directly with the application.
- Chrome MCP significantly reduced manual effort by automating browser interactions and user actions.
- While Playwright was available and functional, Chrome MCP provided greater flexibility for automating, testing and
  iterating on complex user scenarios that required realistic browser behavior.

### Test Generation

**How did AI assist in generating test cases? What did it miss?**  
AI was primarily used during epic generation to create test cases based on acceptance criteria.
However, this process needed refinement:
sometimes the AI generated an excessive number of tests,
while at other times it omitted required cases from the requirements.

### Debugging with AI

**Document cases where AI helped debug issues.**  
`make up` wasn't working, and the application realized by itself where the issue was.
It was a CORS issue and it fixed it autonomously.

### Limitations Encountered

**What couldn't the AI do well? Where was human expertise critical?**  
First of all, AI could not run the BMAD process entirely unsupervised.
Human oversight was required to orchestrate transitions between phases and to ensure a clean context at each step.
Human input was especially important to understand and guide the BMAD process as it progressed.

Note:
The process has been tried to run unsupervised using a main agent to delegate sub-agents with strict phase-by-phase
delegation.
However, the end results turned out to be worse than the supervised approach.
For example:

- One time the loop diverged started massive docstrings.
- Another time the loop generated a massive amount of tests - way more than the ones defined in the epics.md and way
  more than the complexity of the application required.

Secondly, Human intervention is needed to define architecture, in particular, to select the right model based on the
task:
a model has to be smart enough to abstract the spine ( Opus medium works, Composer 2.5 does not )
but not too capable for the use case ( Fable tried encoding the entire application in the spine ).

Lastly, Human intervention is needed to define test cases and story slicing.
Delegating it fully, BMAD creates a massive amount of tests, even for simple applications, and also these slices are
made by preference of the software itself.
Horizontal slicing is not happening by default on BMAD.

### Framework Comparison

The application has been developed only in BMAD.
Hence, framework comparison is not provided.
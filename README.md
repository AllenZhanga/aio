# Aio

[简体中文](README.zh-CN.md)

Aio is a lightweight AI application platform for building, publishing, and operating agents, workflows, knowledge bases, tools, MCP integrations, and human-in-the-loop automation.

It is API-first, SaaS-ready, and designed to run as a private Docker service with a built-in web console and runtime APIs.

## What Aio Provides

Aio focuses on the practical runtime pieces needed to ship AI applications without turning the platform itself into a heavy low-code system:

- **Agent applications** with model settings, prompts, skills, tools, MCP tools, memory, and knowledge retrieval.
- **Workflow applications** based on lightweight DAG execution for LLM, Agent, HTTP, condition, knowledge retrieval, user confirmation, and user form nodes.
- **Human-in-the-loop automation** that pauses workflows, exposes wait tasks through APIs, and resumes execution after user submission.
- **Knowledge base management** for datasets, documents, chunks, indexing, retrieval tests, and runtime retrieval APIs.
- **Tool and MCP integration** for HTTP tools, built-in tools, and MCP servers.
- **Model provider management** for OpenAI-compatible or private model gateways.
- **Runtime observability** for runs, traces, wait tasks, API keys, usage summaries, and audit events.
- **Private deployment** through Docker Compose with Postgres, Redis, MinIO, and Qdrant, or external infrastructure.

## Project Status

Aio is in early MVP implementation. The current codebase contains:

- A Spring Boot API server and runtime engine.
- A React/Vite web console.
- Flyway migrations for identity, providers, applications, runtime records, tools, knowledge, wait tasks, and skills.
- Console login with tenant/workspace context.
- Admin APIs under `/api/aio/admin/**` and runtime APIs under `/v1/**`.
- Docker packaging that builds the web console into the server image.

## Architecture

```text
Browser Console
  │
  ├─ /api/aio/auth/**          Console login and workspace switching
  ├─ /api/aio/admin/**         Admin APIs protected by console token
  └─ /v1/**                    Runtime APIs protected by Runtime API Keys

aio container
  ├─ Web console static assets
  ├─ Spring Boot API server
  ├─ Runtime engine
  ├─ Worker/runtime services
  └─ Flyway migrations

Infrastructure
  ├─ Postgres
  ├─ Redis
  ├─ MinIO
  └─ Qdrant
```

The main deployment image is:

```text
dxnow/aio:${VERSION}
```

## Quick Start with Docker Compose

1. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set strong values for `DB_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `AIO_SECRET_KEY`.

3. Start the embedded stack:

   ```bash
   docker compose up --build
   ```

4. Open the console:

   ```text
   http://localhost:8080
   ```

5. Log in with a configured console account, create an app, publish it, generate a Runtime API Key, and call the runtime API.

## Console Authentication

Private deployments require console login. The web console calls:

```http
POST /api/aio/auth/login
```

The returned console token must be sent to all admin APIs:

```http
Authorization: Bearer <console_token>
```

Runtime APIs under `/v1/**` use Runtime API Keys instead:

```http
Authorization: Bearer sk_xxx
```

### Development Accounts

Local development can configure multiple console accounts through `AIO_CONSOLE_ACCOUNTS`:

```text
admin:admin:default:Admin:admin,alice:alice_dev_password:alice:Alice:member,bob:bob_dev_password:bob:Bob:member
```

Example accounts:

| Username | Password | Role | Workspace |
| --- | --- | --- | --- |
| `admin` | `admin` | `admin` | `default` |
| `alice` | `alice_dev_password` | `member` | `alice` |
| `bob` | `bob_dev_password` | `member` | `bob` |

Change all development passwords before any shared, internal, or production deployment.

### Tenant and Workspace Context

Aio initializes a `default` tenant and a `default` workspace in the embedded private baseline. When `AIO_CONSOLE_ACCOUNTS` contains more workspaces, login creates those workspaces on demand.

Applications, knowledge bases, model providers, API keys, runs, traces, and wait tasks are scoped by tenant and workspace. Workspace switching is permission-checked:

- Admin accounts can access every workspace in the tenant.
- Member accounts can only access workspaces assigned in `AIO_CONSOLE_ACCOUNTS`.
- Admin API requests cannot switch workspace by sending custom tenant/workspace headers; the authenticated console token supplies the context.

### Authentication Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `AIO_CONSOLE_USERNAME` | `admin` | Fallback administrator username when `AIO_CONSOLE_ACCOUNTS` is empty. |
| `AIO_CONSOLE_PASSWORD` | `admin` | Fallback administrator password when `AIO_CONSOLE_ACCOUNTS` is empty. |
| `AIO_CONSOLE_ACCOUNTS` | empty | Optional multi-account list. Format: `username:password:workspaceId:displayName:role`. Role supports `admin` or `member`. |
| `AIO_CONSOLE_SESSION_TTL_SECONDS` | `28800` | Console session TTL in seconds. |
| `AIO_SECRET_KEY` | `dev-only-change-me` | Token signing and secret encryption key. |

## Core API Areas

### Console Auth APIs

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/aio/auth/login` | Log in to the console. |
| `GET` | `/api/aio/auth/me` | Verify the current console token. |
| `POST` | `/api/aio/auth/switch-workspace` | Switch to an authorized workspace. |

### Admin APIs

| Area | Paths |
| --- | --- |
| Identity | `/api/aio/admin/tenants`, `/api/aio/admin/workspaces`, `/api/aio/admin/api-keys` |
| Apps | `/api/aio/admin/apps`, `/api/aio/admin/apps/{appId}/versions`, `/api/aio/admin/apps/{appId}/validate`, `/api/aio/admin/apps/{appId}/publish` |
| Model providers | `/api/aio/admin/providers` |
| Tools and MCP | `/api/aio/admin/tools`, `/api/aio/admin/mcp-servers` |
| Knowledge | `/api/aio/admin/datasets`, `/api/aio/admin/datasets/{datasetId}/documents`, `/api/aio/admin/datasets/{datasetId}/retrieve-test` |
| Wait tasks | `/api/aio/admin/wait-tasks` |
| Observability | `/api/aio/admin/runs`, `/api/aio/admin/runs/{runId}/traces` |
| SaaS operations | `/api/aio/admin/usage-summary`, `/api/aio/admin/audit-events` |

### Runtime APIs

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/apps/{appId}/chat` | Invoke a published Agent app. |
| `POST` | `/v1/apps/{appId}/run` | Run a published Workflow app. |
| `GET` | `/v1/runs/{runId}` | Read run status and output. |
| `GET` | `/v1/runs/{runId}/traces` | Read run traces. |
| `GET` | `/v1/wait-tasks/{waitTaskId}` | Read a wait task. |
| `POST` | `/v1/wait-tasks/{waitTaskId}/submit` | Submit a wait task and resume the workflow. |
| `POST` | `/v1/datasets/{datasetId}/documents` | Add a runtime document. |
| `POST` | `/v1/datasets/{datasetId}/retrieve` | Retrieve knowledge records. |

## Example Runtime Usage

Run a workflow:

```http
POST /v1/apps/{appId}/run
Authorization: Bearer sk_xxx
Content-Type: application/json
```

```json
{
  "inputs": {
    "question": "How should we follow up with this customer?",
    "operator_id": "user_001"
  },
  "response_mode": "blocking"
}
```

If the workflow needs user input, Aio returns a wait task:

```json
{
  "run_id": "run_003",
  "status": "waiting",
  "wait_task": {
    "id": "wait_001",
    "type": "user_confirm",
    "title": "Confirm task creation",
    "actions": [
      {"key": "approve", "label": "Approve"},
      {"key": "reject", "label": "Reject"}
    ]
  }
}
```

Submit the wait task:

```http
POST /v1/wait-tasks/{waitTaskId}/submit
Authorization: Bearer sk_xxx
Idempotency-Key: 8e4b1a1c-6d4f-4fd8-a2ef-42d0a5b39c11
Content-Type: application/json
```

```json
{
  "action": "approve",
  "submitted_by": {
    "type": "external_user",
    "id": "user_001",
    "name": "Alex"
  }
}
```

## Development

### Backend

```bash
mvn -pl apps/server test
```

The server is a Spring Boot application with Flyway migrations in `apps/server/src/main/resources/db/migration`.

### Frontend

```bash
cd apps/web
npm install
npm run dev
npm run build
```

The frontend is a React/Vite console. The Docker build copies `apps/web/dist` into the Spring Boot static resources before packaging the final server image.

### Docker Image Build

```bash
docker build -t dxnow/aio:dev .
```

## Repository Layout

```text
aio/
  apps/
    server/                 Spring Boot API server and runtime
    web/                    React/Vite web console
  packages/
    shared/                 Shared package placeholder
  deploy/
    embedded/               Embedded deployment assets
    external/               External infrastructure deployment assets
    scripts/                Backup, restore, and migration scripts
  docs/
    spec/ai-agent-ops/      Product, architecture, API, deployment, and roadmap docs
  Dockerfile
  docker-compose.yml
  docker-compose.external.yml
  .env.example
```

## Documentation

Design and implementation documents are available under `docs/spec/ai-agent-ops`:

- Product scope
- Architecture
- Data and API design
- Deployment roadmap
- Codebase layout
- Console business design
- Implementation roadmap

## License

License to be decided.


# Aio

Aio is a lightweight AI application platform for building and operating agents, workflows, knowledge bases, tools, MCP integrations, and human-in-the-loop automation.

It is API-first, SaaS-ready, and deployable as a private Docker service.

## What Is Aio?

Aio helps teams build AI-powered applications without turning the platform itself into a heavy system.

It focuses on the practical runtime pieces needed for production:

- Agent applications
- Workflow applications
- Human confirmation and form input
- Knowledge base management
- Tool and MCP integration
- Open APIs for external systems
- SaaS and private Docker deployment

## Core Features

### Agent Apps

Build AI agents with model configuration, prompts, tools, skills, MCP tools, memory, and knowledge base retrieval.

### Workflow Apps

Design lightweight DAG-based workflows with LLM, Agent, HTTP, condition, knowledge retrieval, user confirmation, and user form nodes.

### Human-in-the-Loop

Pause workflows when user confirmation or form input is required, expose wait tasks through APIs, and resume execution after submission.

### Knowledge Bases

Manage datasets, documents, chunks, embeddings, vector search, and retrieval APIs for AI applications.

### Tools and MCP

Connect HTTP tools, built-in tools, and MCP servers so agents can safely use external capabilities.

### API-First Runtime

Call published apps from external systems through stable APIs for chat, workflow runs, wait tasks, traces, and knowledge retrieval.

### Private Deployment

Run Aio as a single application container with embedded dependencies through Docker Compose, or connect it to external Postgres, Redis, object storage, and vector databases.

## Deployment Model

Aio is designed to ship as one main application image:

```text
dxnow/aio:${VERSION}
```

The `aio` container includes:

- Web console
- API server
- Runtime engine
- Worker runtime
- Database migration and initialization scripts

For private deployments, the default Docker Compose package can include:

- `aio`
- `postgres`
- `redis`
- `minio`
- `qdrant`

Production deployments may use external infrastructure instead.

## Example API Usage

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

## Repository Layout

```text
aio/
  apps/
    server/
    web/
  packages/
    shared/
    sdk-js/
    sdk-java/
  deploy/
    embedded/
    external/
    scripts/
  docs/
  Dockerfile
  docker-compose.yml
  docker-compose.external.yml
  .env.example
```

## Project Status

Aio is currently in early product design and implementation planning.

The first milestone focuses on:

- Single-container application image
- Embedded Docker Compose deployment
- App, version, run, trace, and wait task models
- Agent chat API
- Workflow run API
- Human-in-the-loop wait task API
- Basic knowledge base management

## License

License to be decided.


# Addendum — Todo App

Companion to `prd.md`. Technical decisions and API contracts live here; the PRD states behavioral requirements only.

## Entity: Todo

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | string (UUID) | Server-generated, immutable |
| `description` | string | Required, 1–200 characters, trimmed |
| `completed` | boolean | Default `false` |
| `createdAt` | ISO 8601 datetime | Server-set on create, immutable |

Future: optional `userId` field reserved for v2 auth — nullable in v1.

## API Endpoints

Base URL: `http://localhost:{port}/api` `[ASSUMPTION: port chosen at implementation]`

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/todos` | Return all Todos, newest first (by `createdAt` desc) |
| POST | `/todos` | Create Todo; body `{ description }`; returns 201 + Todo |
| PATCH | `/todos/:id` | Update `completed` only in v1; body `{ completed }` |
| DELETE | `/todos/:id` | Hard delete; returns 204 |

### Error responses

JSON shape: `{ "error": "<code>", "message": "<user-facing text>" }`

| HTTP | Code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Empty/whitespace description, length > 200, invalid body |
| 404 | `NOT_FOUND` | Todo id does not exist |
| 500 | `INTERNAL_ERROR` | Unhandled server failure |

Client maps these to inline or banner messages per FR-1 / FR-4 patterns.

## List ordering

- **Display default:** `createdAt` descending (newest at top).
- **New Todo:** Inserts at top; consistent with default sort.

## Local deployment

- API and Client run on developer machine.
- Persistence: file-based SQLite or equivalent local DB (not in-memory).
- Single command or documented two-step start (e.g. `npm run dev` for both) — exact tooling chosen at implementation.

## Auth hooks (v2 placeholder)

- Todo schema allows future `userId`.
- API routes structured so auth middleware can wrap handlers without route redesign.

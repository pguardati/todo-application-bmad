.DEFAULT_GOAL := help
.PHONY: help install dev up test test-backend test-frontend test-e2e lint coverage db-reset ci

BACKEND := backend
FRONTEND := frontend
E2E := e2e
DB_FILE := $(BACKEND)/todo.db

help:
	@grep -E '^[a-z0-9-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

install: ## Install backend, frontend and e2e dependencies
	cd $(BACKEND) && uv sync --group dev
	cd $(FRONTEND) && npm ci --include=dev
	cd $(E2E) && npm ci --include=dev && npx playwright install --with-deps chromium

dev: ## Run the backend on 8000 and the Vite dev server on 5173
	cd $(BACKEND) && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload & \
	api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null' EXIT INT TERM; \
	cd $(FRONTEND) && npm run dev

up: ## Run the built application on 8080 via the dev compose profile
	docker compose --profile dev up --build

lint: ## Lint the backend (Ruff) and typecheck the frontend
	cd $(BACKEND) && uv run ruff check . && uv run ruff format --check .
	cd $(FRONTEND) && npm run lint

test-backend: ## Run backend tests with the 70% coverage gate
	cd $(BACKEND) && uv run coverage run -m pytest && uv run coverage report

test-frontend: ## Run frontend tests
	cd $(FRONTEND) && npm test

test-e2e: ## Run the Playwright suite against the test compose profile
	docker compose --profile test up --build --wait --detach
	cd $(E2E) && npm test; status=$$?; \
	cd .. && docker compose --profile test down; \
	exit $$status

test: test-backend test-frontend test-e2e ## Run every test suite

coverage: ## Report coverage for both sides with their gates enforced
	cd $(BACKEND) && uv run coverage run -m pytest && uv run coverage report
	cd $(FRONTEND) && npm run coverage

db-reset: ## Delete the local database file and the test compose volume
	rm -f $(DB_FILE)
	docker compose --profile test down --volumes 2>/dev/null || true

ci: lint coverage test-e2e ## The full pipeline CI runs
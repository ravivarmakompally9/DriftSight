# DriftSight — marine debris console
# `make help` lists everything.

SHELL := /bin/bash
BACKEND := backend
FRONTEND := frontend
VENV := $(BACKEND)/.venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

# Prefer 3.11 (the documented target) but fall back to whatever modern Python is here.
PYTHON ?= $(shell command -v python3.11 || command -v python3.12 || command -v python3.13 || command -v python3)

.DEFAULT_GOAL := help
.PHONY: help install install-backend install-frontend dev dev-backend dev-frontend \
        test test-backend test-frontend build pages lint clean docker docker-down reset-db

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: install-backend install-frontend ## Install backend and frontend dependencies

install-backend: ## Create the venv and install Python dependencies
	@test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	@$(PIP) install -q --upgrade pip
	@$(PIP) install -q -r $(BACKEND)/requirements.txt
	@echo "backend ready — $$($(PY) -V)"

install-frontend: ## Install Node dependencies
	@cd $(FRONTEND) && npm install --no-audit --no-fund
	@echo "frontend ready"

dev: install ## Run the API on :8000 and the console on :5173
	@echo ""
	@echo "  API      http://localhost:8000      docs at /docs"
	@echo "  Console  http://localhost:5173"
	@echo ""
	@trap 'kill 0' EXIT INT TERM; \
	( cd $(BACKEND) && PYTHONPATH=. ../$(VENV)/bin/python -m uvicorn app.main:app --reload --port 8000 ) & \
	( cd $(FRONTEND) && npm run dev ) & \
	wait

dev-backend: ## Run only the API
	@cd $(BACKEND) && PYTHONPATH=. ../$(VENV)/bin/python -m uvicorn app.main:app --reload --port 8000

dev-frontend: ## Run only the console
	@cd $(FRONTEND) && npm run dev

test: test-backend test-frontend ## Run every check

test-backend: ## pytest: engine parity, detector, tracker, API
	@cd $(BACKEND) && PYTHONPATH=. ../$(VENV)/bin/python -m pytest

test-frontend: ## TypeScript type-check
	@cd $(FRONTEND) && npm run typecheck

build: ## Production build of the console
	@cd $(FRONTEND) && npm run build

pages: ## Build the backend-free demo and publish it to GitHub Pages (gh-pages branch)
	@cd $(FRONTEND) && npm run build:static
	@touch $(FRONTEND)/dist/.nojekyll
	@cd $(FRONTEND)/dist && rm -rf .git && git init -q -b gh-pages && git add -A \
		&& git commit -q -m "Deploy DriftSight static demo" \
		&& git push -f -q $$(git -C ../.. remote get-url origin) gh-pages && rm -rf .git
	@echo "published to the gh-pages branch"

clean: ## Remove build output, caches and the local database
	@rm -rf $(FRONTEND)/dist $(FRONTEND)/node_modules/.vite
	@rm -rf $(BACKEND)/.pytest_cache $(BACKEND)/**/__pycache__ $(BACKEND)/__pycache__
	@rm -f $(BACKEND)/driftsight.db $(BACKEND)/models/detector.joblib
	@echo "cleaned"

reset-db: ## Drop the SQLite database (runs and missions)
	@rm -f $(BACKEND)/driftsight.db && echo "database reset"

docker: ## Build and run the whole stack in containers
	@docker compose up --build

docker-down: ## Stop the containers
	@docker compose down

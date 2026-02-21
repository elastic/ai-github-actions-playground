PEEK_DIR := peek

.PHONY: help setup serve serve-proxy build lint format ci check clean preview test test-unit test-integration test-e2e docker-build docker-run

help:
	@echo "Elastic Peek — a static dashboarding tool powered by Perses + ES|QL"
	@echo ""
	@echo "Available targets:"
	@echo "  setup            - Install Node.js dependencies"
	@echo "  serve            - Start Vite dev server with hot reload (http://localhost:3000)"
	@echo "  serve-proxy      - Start dev server with Elasticsearch proxy (set ES_URL)"
	@echo "  build            - Production build to peek/dist/"
	@echo "  preview          - Preview the production build locally"
	@echo "  lint             - Prettier format check + ESLint + TypeScript type check"
	@echo "  format           - Auto-format code with Prettier"
	@echo "  ci               - Run all checks then build (same as CI pipeline)"
	@echo "  check            - Alias for ci"
	@echo "  test             - Run all tests (unit, integration, e2e)"
	@echo "  test-unit        - Run unit tests"
	@echo "  test-integration - Run integration tests"
	@echo "  test-e2e         - Run end-to-end tests"
	@echo "  clean            - Remove build artifacts and node_modules"
	@echo "  docker-build     - Build the Docker image"
	@echo "  docker-run       - Run the Docker container (set ES_URL)"

setup:
	@echo "Installing dependencies..."
	@cd $(PEEK_DIR) && npm install
	@echo ""
	@echo "✓ Setup complete! Run 'make serve' to start developing."

serve: setup
	@cd $(PEEK_DIR) && npm run dev

serve-proxy: setup
	@echo "Starting dev server with Elasticsearch proxy..."
	@echo "  Proxying /_query → $${ES_URL:-http://localhost:9200}"
	@echo "  Connect the dashboard to: http://localhost:3000"
	@cd $(PEEK_DIR) && ES_URL=$${ES_URL:-http://localhost:9200} npm run dev

build: setup
	@echo "Building for production..."
	@cd $(PEEK_DIR) && npm run build
	@echo ""
	@echo "✓ Build complete: $(PEEK_DIR)/dist/"

preview: build
	@cd $(PEEK_DIR) && npm run preview

lint: setup
	@echo "Running Prettier format check..."
	@cd $(PEEK_DIR) && npx prettier --check src
	@echo ""
	@echo "Running ESLint..."
	@cd $(PEEK_DIR) && npx eslint src
	@echo ""
	@echo "Running TypeScript type check..."
	@cd $(PEEK_DIR) && npx tsc --noEmit
	@echo ""
	@echo "✓ All checks passed."

format: setup
	@echo "Formatting code with Prettier..."
	@cd $(PEEK_DIR) && npx prettier --write src
	@echo ""
	@echo "✓ Formatting complete."

ci: lint test-unit build
	@echo ""
	@echo "✓ CI passed: lint + unit tests + build all green."

check: ci

test: test-unit test-integration test-e2e

test-unit: setup
	@echo "Running unit tests..."
	@cd $(PEEK_DIR) && npm run test:unit

test-integration: setup
	@echo "Running integration tests..."
	@cd $(PEEK_DIR) && npm run test:integration

test-e2e: setup
	@echo "Running e2e tests..."
	@cd $(PEEK_DIR) && npm run test:e2e

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(PEEK_DIR)/dist $(PEEK_DIR)/node_modules
	@echo "✓ Clean complete."

docker-build:
	@echo "Building Docker image..."
	@docker build -t elastic-peek .
	@echo "✓ Docker image built. Run 'make docker-run' to start the container."

docker-run:
	@echo "Starting Docker container..."
	@echo "  Dashboard: http://localhost:8080"
	@echo "  Proxying /_query → $${ES_URL:-http://host.docker.internal:9200}"
	@echo "  Connect the dashboard to: http://localhost:8080"
	@docker run --rm -p 8080:80 -e ES_URL=$${ES_URL:-http://host.docker.internal:9200} elastic-peek

DASHBOARD_DIR := dashboard

.PHONY: help setup serve build lint format check clean preview

help:
	@echo "ES|QL Dashboard — a static dashboarding tool powered by Perses + ES|QL"
	@echo ""
	@echo "Available targets:"
	@echo "  setup    - Install Node.js dependencies"
	@echo "  serve    - Start Vite dev server with hot reload (http://localhost:3000)"
	@echo "  build    - Production build to dashboard/dist/"
	@echo "  preview  - Preview the production build locally"
	@echo "  lint     - Run ESLint, TypeScript type checking, and Prettier format check"
	@echo "  format   - Auto-format code with Prettier"
	@echo "  check    - Run all checks (equivalent to CI)"
	@echo "  clean    - Remove build artifacts and node_modules"

setup:
	@echo "Installing dependencies..."
	@cd $(DASHBOARD_DIR) && npm install
	@echo ""
	@echo "✓ Setup complete! Run 'make serve' to start developing."

serve: setup
	@cd $(DASHBOARD_DIR) && npm run dev

build: setup
	@echo "Building for production..."
	@cd $(DASHBOARD_DIR) && npm run build
	@echo ""
	@echo "✓ Build complete: $(DASHBOARD_DIR)/dist/"

preview: build
	@cd $(DASHBOARD_DIR) && npm run preview

lint:
	@echo "Running Prettier format check..."
	@cd $(DASHBOARD_DIR) && npx prettier --check src
	@echo ""
	@echo "Running ESLint..."
	@cd $(DASHBOARD_DIR) && npx eslint src
	@echo ""
	@echo "Running TypeScript type check..."
	@cd $(DASHBOARD_DIR) && npx tsc --noEmit
	@echo ""
	@echo "✓ All checks passed."

format:
	@echo "Formatting code with Prettier..."
	@cd $(DASHBOARD_DIR) && npx prettier --write src
	@echo ""
	@echo "✓ Formatting complete."

check: lint build

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(DASHBOARD_DIR)/dist $(DASHBOARD_DIR)/node_modules
	@echo "✓ Clean complete."

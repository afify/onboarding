BUN = $(HOME)/.bun/bin/bun
BUNX = $(BUN) x

.PHONY: dev install push lint lint-js lint-html lint-css lint-fix storage

dev: install
	$(BUN) run dev

push:
	$(BUNX) supabase db push

install:
	test -f $(BUN) || curl -fsSL https://bun.sh/install | sh
	$(BUN) install

lint: lint-js lint-html lint-css
	@echo "All linting complete!"

lint-js:
	@echo "==> Running ESLint (JavaScript)..."
	$(BUNX) eslint js/

lint-html:
	@echo "==> Running HTMLHint..."
	$(BUNX) htmlhint *.html --format compact

lint-css:
	@echo "==> Running Stylelint (CSS)..."
	$(BUNX) stylelint "css/**/*.css"

lint-fix:
	@echo "==> Auto-fixing ESLint issues..."
	$(BUNX) eslint js/ --fix
	@echo "==> Auto-fixing Stylelint issues..."
	$(BUNX) stylelint "css/**/*.css" --fix

storage:
	$(BUNX) supabase storage ls ss:///resumes --experimental -r

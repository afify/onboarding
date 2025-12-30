BUN = $(HOME)/.bun/bin/bun
dev: install
	$(BUN) run dev
push:
	$(BUN) x supabase db push
install:
	test -f $(BUN) || curl -fsSL https://bun.sh/install | sh

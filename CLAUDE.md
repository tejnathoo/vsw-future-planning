# Claude Code — read AGENTS.md

This project's build instructions, hard rules, and the dedup engine to port live in **[AGENTS.md](AGENTS.md)**. Read it first, then [PRD.md](PRD.md) (what/why) and [PLAN.md](PLAN.md) (phases + Execution Log).

Non-negotiables (full list in AGENTS.md): never write `master-prospects`; `Contact` always blank; never drop a duplicate silently; this service does not scrape URLs (forward them to n8n); secrets only in `.env`/Railway; use the corrected Category enum. Log every deviation in PLAN.md → Execution Log (living docs; Notion Build Brief is the ultimate source of truth).

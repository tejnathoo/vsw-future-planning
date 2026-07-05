# VSW Slack Intake Service

A small always-on service (Node/TypeScript, deployed on Railway) that adds a **Slack front door** to the existing VSW Sponsor Sourcing pipeline. @mention the bot in Slack with a **URL, a CSV, a PDF, an image of sponsor logos, or a Markdown/text file** and it produces deduped, review-ready prospect rows in the shared Google Sheet `data-staging` tab.

The bot only acts on an explicit **@mention** — for every input type, including file uploads.

It is **additive** — it does not replace the live n8n pipeline (`vsw-dispatcher` + `vsw-scraper`), which stays the engine for URL / Source-Queue scraping. (The old Stagehand companion service now lives in a separate repo, `vsw-scrape` / `vsw-stagehand.git`.)

## What it does

| Input in Slack | Handled by | Result |
|----------------|-----------|--------|
| A **URL** in the message | Forwarded to the existing n8n webhook | n8n scrapes/extracts/dedups/writes + posts its own notice |
| A **CSV** file | This service (parse → classify → dedup → write) | New/merged rows in `data-staging` + threaded reply |
| An **image** of logos | This service (Gemini vision → classify → dedup → write) | New orgs flagged `Review` + threaded reply |
| A **PDF** (deck/prospectus) | This service (Gemini document → classify → dedup → write) | New orgs flagged `Review` + threaded reply |
| A **Markdown/text** file | This service (Anthropic text extraction → classify → dedup → write) | New/merged rows in `data-staging` + threaded reply |

## Docs

- **[PRD.md](PRD.md)** — product requirements, data contract, success criteria, open questions.
- **[PLAN.md](PLAN.md)** — phased build plan, verification gates, and the Execution Log (living).
- **[AGENTS.md](AGENTS.md)** — instructions for coding agents: hard rules, the verbatim dedup engine, vision (Gemini) details, setup.

Source of truth is the Notion **Build Brief** (`f106a46762d14d7eb5f039dc7cf25f1a`) and **Build Spec** (`82a3d52821f9494e81816eab1e91817a`).

## Quick start

```bash
cp .env.example .env      # fill in tokens/keys — see AGENTS.md §Setup
npm install
npm run dev
```

Do **not** commit `.env` or anything in `secrets/` (both are gitignored).

## Providers

- **Vision (logos):** Google Gemini · **Classification:** Anthropic · **Sheets:** Google service account · **Slack:** Bolt (Socket Mode) · **URL path:** existing n8n webhook.

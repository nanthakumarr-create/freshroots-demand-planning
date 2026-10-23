# Freshroots Demand Planning

MESA AI-Native Track · Term 2 · Case 01 — *Deepa's 90-Day Mandate*.

Of the three briefs (Demand Planning, Distributor Service, Operations Intelligence), **Demand Planning** passes every pre-build check: the loss is quantified (₹28–34L/quarter), a baseline exists, SAP data is exportable, and Raghav has documented rules covering 80–85% of decisions. The full reasoning, the five pre-build decisions and the kill criterion are in the app under **“Why this, first”** (`src/app/(app)/about/page.tsx`).

## Component flow (as built)

| Step | Actor | What happens |
|---|---|---|
| 1 | Raghav (frontend) | Clicks **Run Demand Planning** |
| 2 | Next.js server | Reads the latest stored records from Supabase |
| 3 | Supabase (simulated SAP) | Returns 5 datasets seeded from the SAP-style CSV exports in `data/sap-export/` |
| 4 | Rules engine | `src/lib/rules.ts`: 4w vs 12w >20% → 1.5× reorder; stock <6w / >14w; festival +25%; perishables 3–4w |
| 5 | AI (Gemini) | Writes a plain-English reason per SKU + a briefing. **Never sets numbers**; the run still completes if it fails |
| 6 | Results screen | Dashboard: risk tiles, weeks-of-cover chart, demand trend, priority SKUs |
| 7 | Raghav | Reviews, edits and approves (or rejects) each line in the review queue |
| 8 | Next.js server | Validates vendor, item, rate and quantity, then calls the Zoho Inventory API |
| 9 | Zoho Inventory | Creates a **draft** purchase order per vendor, returns ID/number/status |
| 10 | Confirmation | Purchase orders page with PO number, status and an “Open in Zoho” link |

## Stack

Next.js 16 (App Router, Cache Components) · Supabase Postgres (schema `freshroots`, server-side access only) · Gemini (`gemini-flash-latest`) · Zoho Inventory API (India DC) · Recharts · Tailwind 4. A shared passcode protects the app.

## Run locally

```bash
npm install
# .env.local needs: DATABASE_URL, DATABASE_URL_SESSION, ZOHO_* (see scripts/zoho-login.mjs),
# GEMINI_API_KEY, GEMINI_MODEL, APP_PASSCODE, SESSION_SECRET
npm run seed         # create schema + load CSVs into Supabase
npm run seed:zoho    # create demo vendors/items in Zoho and store their IDs
npm run dev
```

`node scripts/zoho-login.mjs` runs a one-time OAuth flow and saves Zoho credentials to `~/.freshroots/zoho.json` (outside the repo).

## Tests

- `npm test`: rule-engine unit tests against the sample data (stockout, overstock, perishable windows, festival uplift, judgment cases).
- `BASE_URL=… APP_PASSCODE=… node tests/e2e.mjs [--no-po]`: drives the whole flow in Chrome: passcode gate, run, edit + approve, validation, Zoho draft POs, orders page, and a 375px mobile check. Without `--no-po` it creates real **draft** POs in Zoho.
- `node --env-file=.env.local scripts/verify-zoho-pos.mjs` cross-checks saved POs against Zoho.

## Known limits / honest notes

- SAP access is simulated with Supabase seeded from CSV exports (as the component map specifies).
- The sample has 15 SKUs, 16 weeks and one distributor per SKU; the brief describes 400 SKUs × 1,200 distributors and 3 years of history. Two distributors are in Karnataka/Gujarat, which conflicts with “Maharashtra and Goa”. Flagged on the SAP data page.
- Purchase rates are not in the export; demo rates are used only to price draft POs.
- “Needs judgment” (history < 12 weeks or volatile sales) is an addition to Raghav's rules to route his 15–20% judgment cases to him explicitly.

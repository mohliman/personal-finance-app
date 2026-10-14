# Personal Finance

A full-stack finance tracker with authenticated private accounts, editable transactions, monthly budgets, savings pots, recurring-expense summaries, and persistent data. React + TypeScript frontend, Node 24 API, and SQLite storage.

[Open the live full-stack app](https://personal-finance-ui.vercel.app). The original public address is retained through a Vercel rewrite to Render's free Node compute, with a separate Turso database. Create an account and choose sample records or an empty ledger. Free compute sleeps during inactivity, so the first visit can take 50 seconds or more.

## Run

```powershell
npm ci
npm run dev
```

React UI: http://127.0.0.1:5197. For a single compiled server, run `npm run build` followed by `npm start` and open http://127.0.0.1:4200. Create your own account. Choose sample records for the August 2024 challenge data, or start empty.

## Check

```powershell
npm test
npm run test:server
npm run test:fullstack
```

See [setup, accounting, migration, verification, and deployment](docs/fullstack.md). Prior frontend documentation is retained in [frontend history](docs-frontend-history.md). Vercel and Render deploy the full-stack source from `main`. The direct [Render origin](https://baqir-personal-finance.onrender.com) also works.

Frontend challenge design and supplied assets: Frontend Mentor. Existing asset/font licenses and premium-design exclusions are retained. No bank connections or real payments are implemented.

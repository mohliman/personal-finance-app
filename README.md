# Personal Finance

A full-stack finance tracker with authenticated private accounts, editable transactions, monthly budgets, savings pots, recurring-expense summaries, and persistent data. React + TypeScript frontend, Node 24 API, and SQLite storage.

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

See [setup, accounting, migration, verification, and deployment](docs/fullstack.md). Prior frontend documentation is retained in [frontend history](docs-frontend-history.md). The existing [Vercel demo](https://personal-finance-ui.vercel.app) remains the earlier frontend version; this backend has not been deployed.

Frontend challenge design and supplied assets: Frontend Mentor. Existing asset/font licenses and premium-design exclusions are retained. No bank connections or real payments are implemented.

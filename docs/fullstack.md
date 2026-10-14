# Personal Finance full-stack implementation

The existing React interface now connects to a Node 24 API with SQLite storage. Each account owns its transaction ledger, budgets, savings pots, opening balance, and selected reporting month.

## Run locally

```powershell
npm ci
npm run dev
```

Open the React development UI at `http://127.0.0.1:5197`. `/api` is proxied to the backend at port 4200. Vite prints another UI port if its configured port is occupied.

For the compiled application:

```powershell
npm run build
npm start
```

Open `http://127.0.0.1:4200` and create an account. Choose sample records at registration to explore the original challenge, or leave that option unchecked to start your own empty ledger. Sample records use August 2024; empty accounts use the current month. The toolbar lets you change the reporting month, adjust the opening balance, refresh records, and sign out.

Transactions supports income and expense creation, editing, deletion, dates, categories, recurring flags, search, sorting, and pagination. Overview and budget spending use the signed-in account's transactions. Recurring bills are inferred from recorded recurring expenses, rather than connected to a payment service.

## Accounting model

All persisted money uses integer cents. The current balance equals opening balance plus the sum of recorded income/expenses minus money reserved in pots. Monthly income, expenses, and category spending follow the selected reporting month. Current balance includes the whole ledger, irrespective of the reporting month. Recording or editing an expense changes the ledger balance; it does not contact a bank. An account can show a negative balance when recorded spending exceeds its funds. Pot transfers cannot overdraw the current balance or withdraw more than the pot contains.

The server recomputes balances from records. Editing a pot cannot invent savings: the server retains its existing total, and a new pot starts at zero. Deleting a pot makes its reserved money available again through the balance calculation. Every mutation is validated and saved transactionally. Revision checks prevent two sessions from silently overwriting each other.

## Earlier browser data

The previous `personal-finance:v1` localStorage key is left intact. In **Opening balance**, use **Import browser records** from the earlier browser/origin. Create an empty account for import. The server refuses to import over existing transaction, budget, or pot records. It validates the older state, imports its budgets and pots with their saved totals, imports the original sample transaction history, and derives the opening balance so the earlier current balance is preserved. The original challenge's transactions were read-only, so the sample history is the appropriate history for that migration.

## Code and API

- `server/core.mjs`: HTTP serving, account/session lifecycle, CSRF/origin checks, and rate limits.
- `server/index.mjs`: account ownership, normalized SQL tables, action validation, transactions, and balance calculation.
- `src/store.tsx`: authenticated snapshots and acknowledged saves.
- `src/TransactionEditor.tsx`: manual transaction forms.
- `src/AccountBar.tsx`: reporting month, opening balance, migration, and account controls.

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/health` | Readiness check |
| GET | `/api/session` | User and CSRF token |
| POST | `/api/register`, `/api/login`, `/api/logout` | Account/session lifecycle |
| GET | `/api/state` | Authenticated account snapshot |
| POST | `/api/actions` | Validated mutation with revision number |

Actions: save/delete transaction, save/delete budget, save/delete pot, transfer, set-month, set-opening, and import-legacy. Every SQL operation scopes its records to the authenticated user. The client cannot choose another account's owner ID. Amounts, category/theme choices, duplicate plans, dates, transfer limits, and revision numbers are checked on the server. Validation failures leave data unchanged.

Passwords use salted asynchronous scrypt. Session secrets are random; only their hashes are stored. Cookies are HttpOnly, SameSite=Strict, and Secure when APP_ORIGIN is HTTPS. Mutations require JSON, a CSRF token, and an allowed origin. Sign-out revokes the session; sessions expire after seven days.

## Verification

```powershell
npm test
npm run test:server
npm run test:fullstack
```

The implementation passed 13 existing calculation tests, 5 backend integration scenarios, and 9 browser workflow checks. Backend coverage includes editable transactions, cent arithmetic, monthly totals, invalid dates, invalid amounts, pot overdrafts, duplicate budgets/pots, concurrent transfers, account isolation, logout/login, persistence after restart, and migration preservation. Browser coverage includes registration, opening balance, transaction creation/edit/reload, pot creation and transfer, derived balances, sign-out/sign-in, and five routes at 390px. The desktop overview axe scan returned zero WCAG A/AA violations. Evidence is in `verification/fullstack/`. Physical-device and assistive-technology testing remain outside this verification.

## Deploy

Use a Node 24 host or the included Dockerfile, with the UI and API served from the same origin. The existing Vercel URL is the earlier frontend-only deployment; these backend changes have not been published there. A static Vite deployment alone cannot run this server.

Set `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, `APP_ORIGIN=https://your-public-domain`, and `DATABASE_PATH=/data/app.sqlite`. Production startup requires HTTPS APP_ORIGIN. Use a persistent volume and one application instance for this SQLite version. The schema initializes automatically and records migration versions. Plan consistent SQLite backups and restore testing before accepting important data.

Docker packaging was prepared but not executed. No remote backend was deployed. Email verification, password recovery, operational monitoring, and managed backups remain production work. There are no bank connections, bill payments, investment features, or real money transfers.

Frontend challenge design and supplied assets are credited to Frontend Mentor. Premium design files remain excluded. Existing font licenses and challenge documentation are retained.

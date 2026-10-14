import {
  createApplication,
  fail,
  listen,
  textValue,
  transaction,
  uid,
  moneyCents,
} from "./core.mjs";
import {
  categories,
  themes,
  initialState,
  transactions as samples,
  financeReducer,
  transferError,
  validStoredState,
} from "../src/finance.ts";
const schema = `
CREATE TABLE IF NOT EXISTS accounts(user_id TEXT PRIMARY KEY REFERENCES users(id), opening_cents INTEGER NOT NULL DEFAULT 0, month TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS transactions(user_id TEXT NOT NULL REFERENCES accounts(user_id), id TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, date TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents!=0), recurring INTEGER NOT NULL CHECK(recurring IN (0,1)), avatar TEXT NOT NULL, PRIMARY KEY(user_id,id));
CREATE TABLE IF NOT EXISTS budgets(user_id TEXT NOT NULL REFERENCES accounts(user_id), id TEXT NOT NULL, category TEXT NOT NULL, maximum_cents INTEGER NOT NULL CHECK(maximum_cents>0), theme TEXT NOT NULL, PRIMARY KEY(user_id,id), UNIQUE(user_id,category));
CREATE TABLE IF NOT EXISTS pots(user_id TEXT NOT NULL REFERENCES accounts(user_id), id TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE, target_cents INTEGER NOT NULL CHECK(target_cents>0), total_cents INTEGER NOT NULL CHECK(total_cents>=0), theme TEXT NOT NULL, PRIMARY KEY(user_id,id), UNIQUE(user_id,name));
CREATE INDEX IF NOT EXISTS transactions_date ON transactions(user_id,date);
INSERT OR IGNORE INTO schema_migrations VALUES(2,datetime('now'));`;
function snapshot(db, userId) {
  const account = db
    .prepare("SELECT * FROM accounts WHERE user_id=?")
    .get(userId);
  const rows = db
    .prepare(
      "SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC,rowid DESC",
    )
    .all(userId);
  const transactions = rows.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    date: t.date,
    amount: t.amount_cents / 100,
    recurring: !!t.recurring,
    avatar: t.avatar,
  }));
  const budgets = db
    .prepare("SELECT * FROM budgets WHERE user_id=? ORDER BY rowid")
    .all(userId)
    .map((b) => ({
      id: b.id,
      category: b.category,
      maximum: b.maximum_cents / 100,
      theme: b.theme,
    }));
  const pots = db
    .prepare("SELECT * FROM pots WHERE user_id=? ORDER BY rowid")
    .all(userId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      target: p.target_cents / 100,
      total: p.total_cents / 100,
      theme: p.theme,
    }));
  const current =
    account.opening_cents +
    rows.reduce((sum, t) => sum + t.amount_cents, 0) -
    pots.reduce((sum, p) => sum + moneyCents(p.total), 0);
  const monthRows = rows.filter((t) => t.date.startsWith(account.month));
  const income = monthRows
    .filter((t) => t.amount_cents > 0)
    .reduce((sum, t) => sum + t.amount_cents, 0);
  const expenses = -monthRows
    .filter((t) => t.amount_cents < 0)
    .reduce((sum, t) => sum + t.amount_cents, 0);
  return {
    state: {
      balance: {
        current: current / 100,
        income: income / 100,
        expenses: expenses / 100,
      },
      budgets,
      pots,
    },
    transactions,
    month: account.month,
    revision: account.revision,
    openingBalance: account.opening_cents / 100,
  };
}
function writePlans(db, userId, state) {
  db.prepare("DELETE FROM budgets WHERE user_id=?").run(userId);
  db.prepare("DELETE FROM pots WHERE user_id=?").run(userId);
  for (const b of state.budgets)
    db.prepare("INSERT INTO budgets VALUES(?,?,?,?,?)").run(
      userId,
      b.id,
      b.category,
      moneyCents(b.maximum, true),
      b.theme,
    );
  for (const p of state.pots)
    db.prepare("INSERT INTO pots VALUES(?,?,?,?,?,?)").run(
      userId,
      p.id,
      p.name,
      moneyCents(p.target, true),
      moneyCents(p.total),
      p.theme,
    );
}
function loadSample(db, userId) {
  writePlans(db, userId, initialState);
  for (const t of samples)
    db.prepare("INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?)").run(
      userId,
      uid(),
      t.name,
      t.category,
      t.date,
      moneyCents(t.amount),
      Number(t.recurring),
      t.avatar,
    );
  const opening =
    moneyCents(initialState.balance.current) +
    initialState.pots.reduce((sum, p) => sum + moneyCents(p.total), 0) -
    samples.reduce((sum, t) => sum + moneyCents(t.amount), 0);
  db.prepare("UPDATE accounts SET opening_cents=?,month=? WHERE user_id=?").run(
    opening,
    "2024-08",
    userId,
  );
}
const validMonth = (v) =>
  typeof v === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(v);
const validTheme = (v) => themes.some((t) => t[1] === v);
function validateAction(action, current) {
  if (!action || typeof action !== "object") fail(422, "Send a valid action.");
  const { type } = action;
  if (type === "save-budget") {
    const b = action.budget;
    if (!b || !categories.includes(b.category) || !validTheme(b.theme))
      fail(422, "Choose a valid budget category and colour.");
    textValue(b.id, "Budget ID", 100);
    moneyCents(b.maximum, true);
    if (
      current.state.budgets.some(
        (old) => old.id !== b.id && old.category === b.category,
      )
    )
      fail(422, "This category already has a budget.");
  } else if (type === "save-pot") {
    const p = action.pot;
    if (!p || !validTheme(p.theme)) fail(422, "Choose a valid pot colour.");
    textValue(p.id, "Pot ID", 100);
    textValue(p.name, "Pot name", 30);
    moneyCents(p.target, true);
    if (
      current.state.pots.some(
        (old) =>
          old.id !== p.id &&
          old.name.toLowerCase() === p.name.trim().toLowerCase(),
      )
    )
      fail(422, "A pot with this name already exists.");
  } else if (type === "delete-budget" || type === "delete-pot") {
    textValue(action.id, "Record ID", 100);
    if (
      !current.state[type === "delete-budget" ? "budgets" : "pots"].some(
        (r) => r.id === action.id,
      )
    )
      fail(404, "Record not found.");
  } else if (type === "transfer") {
    if (!["add", "withdraw"].includes(action.direction))
      fail(422, "Choose add or withdraw.");
    moneyCents(action.amount, true);
    const message = transferError(
      current.state,
      action.id,
      action.amount,
      action.direction,
    );
    if (message) fail(422, message);
  } else fail(422, "Unknown action.");
}
const adapter = {
  name: "finance",
  initialize(db) {
    db.exec(schema);
  },
  register(db, user, body) {
    db.prepare("INSERT INTO accounts(user_id,month) VALUES(?,?)").run(
      user.id,
      new Date().toISOString().slice(0, 7),
    );
    if (body.demo === true) loadSample(db, user.id);
  },
  handle({ db, user, req, url, body }) {
    if (url.pathname === "/api/state" && req.method === "GET")
      return snapshot(db, user.id);
    if (url.pathname !== "/api/actions" || req.method !== "POST")
      return undefined;
    return transaction(db, () => {
      const current = snapshot(db, user.id);
      if (
        !Number.isSafeInteger(body.revision) ||
        body.revision !== current.revision
      )
        fail(
          409,
          "Your account changed in another session. Refresh the records before editing again.",
        );
      const action = body.action;
      if (!action || typeof action !== "object")
        fail(422, "Send a valid action.");
      if (action.type === "save-transaction") {
        const t = action.transaction;
        if (!t) fail(422, "Enter transaction details.");
        const name = textValue(t.name, "Recipient or sender", 100);
        const id = textValue(t.id, "Transaction ID", 100);
        if (
          !categories.includes(t.category) ||
          typeof t.recurring !== "boolean"
        )
          fail(422, "Choose a valid category and recurring status.");
        if (
          typeof t.date !== "string" ||
          !/^20\d{2}-\d{2}-\d{2}$/.test(t.date) ||
          !Number.isFinite(Date.parse(`${t.date}T00:00:00Z`)) ||
          new Date(`${t.date}T00:00:00Z`).toISOString().slice(0, 10) !== t.date
        )
          fail(422, "Choose a valid transaction date.");
        const cents = moneyCents(t.amount);
        if (cents === 0) fail(422, "Enter an amount greater than zero.");
        // Avatar is server-selected. Untrusted URLs never reach the interface.
        const avatar = "/assets/images/avatars/transaction.svg";
        db.prepare(
          "INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET name=excluded.name,category=excluded.category,date=excluded.date,amount_cents=excluded.amount_cents,recurring=excluded.recurring",
        ).run(
          user.id,
          id,
          name,
          t.category,
          t.date,
          cents,
          Number(t.recurring),
          avatar,
        );
      } else if (action.type === "delete-transaction") {
        textValue(action.id, "Transaction ID", 100);
        if (
          !db
            .prepare("DELETE FROM transactions WHERE user_id=? AND id=?")
            .run(user.id, action.id).changes
        )
          fail(404, "Transaction not found.");
      } else if (action.type === "set-month") {
        if (!validMonth(action.month))
          fail(422, "Choose a valid month between 2000 and 2099.");
        db.prepare("UPDATE accounts SET month=? WHERE user_id=?").run(
          action.month,
          user.id,
        );
      } else if (action.type === "set-opening") {
        const cents = moneyCents(action.amount);
        db.prepare("UPDATE accounts SET opening_cents=? WHERE user_id=?").run(
          cents,
          user.id,
        );
      } else if (action.type === "import-legacy") {
        if (
          current.transactions.length ||
          current.state.budgets.length ||
          current.state.pots.length
        )
          fail(
            409,
            "Import into an empty account to preserve existing records.",
          );
        if (!validStoredState(action.state))
          fail(422, "The earlier browser records are invalid.");
        loadSample(db, user.id);
        writePlans(db, user.id, action.state);
        const opening =
          moneyCents(action.state.balance.current) +
          action.state.pots.reduce((sum, p) => sum + moneyCents(p.total), 0) -
          samples.reduce((sum, t) => sum + moneyCents(t.amount), 0);
        db.prepare("UPDATE accounts SET opening_cents=? WHERE user_id=?").run(
          opening,
          user.id,
        );
      } else {
        validateAction(action, current);
        if (action.type === "save-pot")
          action.pot.name = action.pot.name.trim();
        const next = financeReducer(current.state, action);
        writePlans(db, user.id, next);
      }
      db.prepare("UPDATE accounts SET revision=revision+1 WHERE user_id=?").run(
        user.id,
      );
      const result = snapshot(db, user.id);
      if (!Number.isSafeInteger(moneyCents(result.state.balance.current)))
        fail(422, "Account total is too large.");
      return result;
    });
  },
};
export function createFinance(options = {}) {
  return createApplication(adapter, options);
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/server/dist/index.mjs"))
  listen(createFinance(), 4200);

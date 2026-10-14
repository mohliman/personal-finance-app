import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFinance } from "./dist/index.mjs";
import { launch } from "./test-client.mjs";
async function action(client, action, revision) {
  return client.request("/api/actions", "POST", {
    action,
    revision: revision ?? (await client.request("/api/state")).body.revision,
  });
}
test("Finance starts empty, calculates editable transactions in cents, and selects monthly totals", async (t) => {
  const { app, client } = await launch(createFinance);
  t.after(() => app.close());
  const user = client();
  assert.equal((await user.request("/api/state")).status, 401);
  assert.equal((await user.register("finance@example.test")).status, 200);
  assert.equal((await user.request("/api/state")).body.transactions.length, 0);
  await action(user, { type: "set-month", month: "2026-10" });
  const income = {
    id: "income",
    name: "Salary",
    category: "General",
    date: "2026-10-01",
    amount: 1000.1,
    recurring: false,
  };
  const expense = {
    id: "expense",
    name: "Groceries",
    category: "Groceries",
    date: "2026-10-02",
    amount: -20.2,
    recurring: false,
  };
  assert.equal(
    (await action(user, { type: "save-transaction", transaction: income }))
      .status,
    200,
  );
  const result = await action(user, {
    type: "save-transaction",
    transaction: expense,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.state.balance, {
    current: 979.9,
    income: 1000.1,
    expenses: 20.2,
  });
  const edit = await action(user, {
    type: "save-transaction",
    transaction: { ...expense, amount: -30.25 },
  });
  assert.equal(edit.body.state.balance.current, 969.85);
  assert.equal(edit.body.transactions.length, 2);
  assert.equal(
    (
      await action(user, {
        type: "save-transaction",
        transaction: { ...expense, date: "2026-02-30" },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await action(user, {
        type: "save-transaction",
        transaction: { ...expense, date: "2026-99-99" },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await action(user, {
        type: "save-transaction",
        transaction: { ...expense, amount: 1.234 },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await action(user, {
        type: "save-transaction",
        transaction: { ...expense, amount: 0 },
      })
    ).status,
    422,
  );
  const month = await action(user, { type: "set-month", month: "2026-09" });
  assert.deepEqual(month.body.state.balance, {
    current: 969.85,
    income: 0,
    expenses: 0,
  });
  const deleted = await action(user, {
    type: "delete-transaction",
    id: "expense",
  });
  assert.equal(deleted.body.state.balance.current, 1000.1);
});
test("Finance prevents savings overdrafts, duplicate plans, and lost concurrent transfers", async (t) => {
  const { app, client } = await launch(createFinance);
  t.after(() => app.close());
  const user = client();
  await user.register("savings@example.test");
  await action(user, { type: "set-opening", amount: 500 });
  const pot = {
    id: "pot",
    name: "Laptop",
    target: 1500,
    total: 999999,
    theme: "#277C78",
  };
  const create = await action(user, { type: "save-pot", pot });
  assert.equal(create.body.state.pots[0].total, 0);
  const add = await action(user, {
    type: "transfer",
    id: "pot",
    amount: 100.25,
    direction: "add",
  });
  assert.equal(add.body.state.balance.current, 399.75);
  assert.equal(add.body.state.pots[0].total, 100.25);
  assert.equal(
    (
      await action(user, {
        type: "transfer",
        id: "pot",
        amount: 400,
        direction: "add",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await action(user, {
        type: "transfer",
        id: "pot",
        amount: 100.26,
        direction: "withdraw",
      })
    ).status,
    422,
  );
  assert.equal(
    (await action(user, { type: "save-pot", pot: { ...pot, id: "duplicate" } }))
      .status,
    422,
  );
  const edit = await action(user, {
    type: "save-pot",
    pot: { ...pot, name: "New laptop", total: 0 },
  });
  assert.equal(edit.body.state.pots[0].total, 100.25);
  const revision = edit.body.revision;
  const simultaneous = await Promise.all([
    action(
      user,
      { type: "transfer", id: "pot", amount: 300, direction: "add" },
      revision,
    ),
    action(
      user,
      { type: "transfer", id: "pot", amount: 300, direction: "add" },
      revision,
    ),
  ]);
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]);
  const deleted = await action(user, { type: "delete-pot", id: "pot" });
  assert.equal(deleted.body.state.balance.current, 500);
  const budget = {
    id: "budget",
    category: "Bills",
    maximum: 100,
    theme: "#277C78",
  };
  assert.equal(
    (await action(user, { type: "save-budget", budget })).status,
    200,
  );
  assert.equal(
    (
      await action(user, {
        type: "save-budget",
        budget: { ...budget, id: "other" },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await action(user, {
        type: "save-budget",
        budget: { ...budget, maximum: 1.234 },
      })
    ).status,
    422,
  );
  assert.equal((await action(user, { type: "unknown" })).status, 422);
});
test("Finance accounts cannot read or delete each other's records; logout revokes access", async (t) => {
  const { app, client } = await launch(createFinance);
  t.after(() => app.close());
  const alice = client(),
    bob = client();
  await alice.register("alice@example.test", "Alice", true);
  await bob.register("bob@example.test", "Bob");
  const a = (await alice.request("/api/state")).body;
  const b = (await bob.request("/api/state")).body;
  assert.equal(b.transactions.length, 0);
  assert.equal(
    (
      await action(bob, {
        type: "delete-transaction",
        id: a.transactions[0].id,
      })
    ).status,
    404,
  );
  assert.equal(
    (await action(bob, { type: "delete-pot", id: a.state.pots[0].id })).status,
    404,
  );
  assert.equal(
    (await alice.request("/api/state")).body.transactions.length,
    a.transactions.length,
  );
  assert.equal(
    (
      await bob.request("/api/login", "POST", {
        email: "alice@example.test",
        password: "wrong password here",
      })
    ).status,
    401,
  );
  assert.equal((await alice.request("/api/logout", "POST", {})).status, 200);
  assert.equal((await alice.request("/api/state")).status, 401);
  assert.equal(
    (
      await alice.request("/api/login", "POST", {
        email: "alice@example.test",
        password: "correct horse battery staple",
      })
    ).status,
    200,
  );
  assert.equal(
    (await alice.request("/api/state")).body.transactions.length,
    a.transactions.length,
  );
});
test("Finance account records and authenticated sessions survive server restarts", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "finance-api-"));
  const databasePath = join(directory, "app.sqlite");
  const first = await launch(createFinance, { databasePath });
  const user = first.client();
  await user.register("persist@example.test");
  await action(user, { type: "set-opening", amount: 250.35 });
  const sessionCookie = user.cookie();
  await first.app.close();
  const second = await launch(createFinance, { databasePath });
  t.after(() => second.app.close());
  const response = await fetch(second.origin + "/api/state", {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).state.balance.current, 250.35);
});
test("Finance imports earlier browser savings without losing money and preserves existing accounts", async (t) => {
  const { app, client } = await launch(createFinance);
  t.after(() => app.close());
  const user = client();
  await user.register("import@example.test");
  const source = JSON.parse(readFileSync("starter-code/data.json", "utf8"));
  const state = {
    balance: source.balance,
    budgets: source.budgets.map((b, i) => ({ ...b, id: `b-${i}` })),
    pots: source.pots.map((p, i) => ({ ...p, id: `p-${i}` })),
  };
  assert.equal(
    (
      await action(user, {
        type: "import-legacy",
        state: { ...state, pots: [null] },
      })
    ).status,
    422,
  );
  assert.equal((await user.request("/api/state")).body.transactions.length, 0);
  const imported = await action(user, { type: "import-legacy", state });
  assert.equal(imported.status, 200);
  assert.equal(imported.body.state.balance.current, state.balance.current);
  assert.equal(imported.body.state.pots[0].total, state.pots[0].total);
  assert.equal(imported.body.month, "2024-08");
  assert.equal(imported.body.transactions.length, source.transactions.length);
  assert.equal(
    (await action(user, { type: "import-legacy", state })).status,
    409,
  );
});

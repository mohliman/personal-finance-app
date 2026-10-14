import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Avatar,
  Card,
  Empty,
  Icon,
  PageHeading,
  Search,
  SortSelect,
} from "../components";
import { categories, money, shortDate, sortTransactions } from "../finance";
import type { SortOrder, Transaction } from "../types";
import { useFinance } from "../store";
import { TransactionEditor } from "../TransactionEditor";
import s from "../App.module.css";

export default function Transactions() {
  const { transactions, dispatch, busy } = useFinance();
  const [editing, setEditing] = useState<Transaction | null | undefined>(
    undefined,
  );
  const [params, setParams] = useSearchParams();
  const category = categories.includes(params.get("category") ?? "")
    ? params.get("category")!
    : "All Transactions";
  const search = params.get("search") ?? "";
  const [sort, setSort] = useState<SortOrder>("Latest");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filtered = sortTransactions(
    transactions.filter(
      (t) =>
        (category === "All Transactions" || t.category === category) &&
        t.name.toLowerCase().includes(search.toLowerCase().trim()),
    ),
    sort,
  );
  const count = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(count, Math.floor(page));
  const visible = filtered.slice((current - 1) * 10, current * 10);
  function update(key: string, value: string) {
    // Navigation commits can be deferred. Merge into the current URL so rapid
    // search/category/sort changes cannot restore an older filter value.
    const next = new URLSearchParams(window.location.search);
    if (value && value !== "All Transactions") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  }
  return (
    <>
      <PageHeading
        title="Transactions"
        actionLabel="+ Add Transaction"
        action={() => setEditing(null)}
        disabled={busy}
      />
      {editing !== undefined && (
        <TransactionEditor
          transaction={editing ?? undefined}
          onClose={() => setEditing(undefined)}
        />
      )}
      <Card className={s.transactionsCard}>
        <div className={s.toolbar}>
          <Search
            value={search}
            onChange={(value) => update("search", value)}
            placeholder="Search transactions"
          />
          <div className={s.filters}>
            <SortSelect
              value={sort}
              onChange={(value) => {
                setSort(value);
                update("page", "1");
              }}
            />
            <label className={`${s.filterLabel} ${s.categoryFilter}`}>
              <span>Category</span>
              <Icon name="filter-mobile" />
              <select
                aria-label="Category"
                value={category}
                onChange={(e) => update("category", e.target.value)}
              >
                <option>All Transactions</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <table className={s.transactionTable}>
          <caption className={s.srOnly}>
            Transactions for{" "}
            {category === "All Transactions" ? "all categories" : category}.
            Page {current} of {count}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Recipient / Sender</th>
              <th scope="col">Category</th>
              <th scope="col">Transaction Date</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => (
              <tr key={t.id ?? `${t.date}-${t.name}-${i}`}>
                <td>
                  <div className={s.recipient}>
                    <Avatar transaction={t} />
                    <div>
                      <strong>{t.name}</strong>
                      <span className={s.mobileCategory}>{t.category}</span>
                      <div className="transaction-actions">
                        <button
                          disabled={busy}
                          onClick={() => setEditing(t)}
                          aria-label={`Edit transaction ${t.name}`}
                        >
                          Edit
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete the transaction for ${t.name}?`,
                              )
                            )
                              void dispatch({
                                type: "delete-transaction",
                                id: t.id!,
                              });
                          }}
                          aria-label={`Delete transaction ${t.name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
                <td>{t.category}</td>
                <td>{shortDate(t.date)}</td>
                <td>
                  <strong className={t.amount > 0 ? s.positive : ""}>
                    {t.amount > 0 ? "+" : "-"}
                    {money(Math.abs(t.amount))}
                  </strong>
                  <span className={s.mobileDate}>{shortDate(t.date)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <Empty>
            No transactions match your search. Try another name or category.
          </Empty>
        )}
        <div className={s.pagination}>
          <button
            className={s.pageStep}
            disabled={current === 1}
            onClick={() => update("page", String(current - 1))}
            aria-label="Previous page"
          >
            <Icon name="caret-left" />
            <span>Prev</span>
          </button>
          <div className={s.pageNumbers}>
            {Array.from({ length: count }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={p === current ? s.selectedPage : ""}
                aria-label={`Page ${p}`}
                aria-current={p === current ? "page" : undefined}
                onClick={() => update("page", String(p))}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            className={s.pageStep}
            disabled={current === count}
            onClick={() => update("page", String(current + 1))}
            aria-label="Next page"
          >
            <span>Next</span>
            <Icon name="caret-right" />
          </button>
        </div>
        <p className={s.resultCount} role="status">
          {filtered.length
            ? `Showing ${(current - 1) * 10 + 1}–${Math.min(current * 10, filtered.length)} of ${filtered.length} transactions`
            : "0 transactions"}
        </p>
      </Card>
    </>
  );
}

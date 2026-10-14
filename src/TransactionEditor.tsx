import { useEffect, useRef, useState, type FormEvent } from "react";
import { categories } from "./finance";
import { useFinance } from "./store";
import type { Transaction } from "./types";
import s from "./App.module.css";
function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function TransactionEditor({
  transaction,
  onClose,
}: {
  transaction?: Transaction;
  onClose: () => void;
}) {
  const { dispatch, busy, storageWarning } = useFinance();
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const opener = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      opener?.focus();
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = String(form.get("amount"));
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError(
        "Enter an amount greater than zero with up to two decimal places.",
      );
      return;
    }
    setError("");
    const saved = await dispatch({
      type: "save-transaction",
      transaction: {
        id: transaction?.id ?? crypto.randomUUID(),
        name: String(form.get("name")).trim(),
        category: String(form.get("category")),
        date: String(form.get("date")),
        amount: Number(amount) * (form.get("direction") === "income" ? 1 : -1),
        recurring: form.get("recurring") === "on",
        avatar: transaction?.avatar ?? "",
      },
    });
    if (saved) onClose();
  }
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby="transaction-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className={s.modalHeading}>
        <h2 id="transaction-title">
          {transaction ? "Edit Transaction" : "Add Transaction"}
        </h2>
        <button
          className={s.iconButton}
          disabled={busy}
          aria-label="Close transaction form"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="transaction-fields">
          <div className={s.field}>
            <label htmlFor="tx-name">Recipient / Sender</label>
            <input
              autoFocus
              id="tx-name"
              name="name"
              defaultValue={transaction?.name}
              required
              maxLength={100}
            />
          </div>
          <div className={s.field}>
            <label htmlFor="tx-direction">Type</label>
            <select
              id="tx-direction"
              name="direction"
              defaultValue={
                transaction && transaction.amount > 0 ? "income" : "expense"
              }
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className={s.field}>
            <label htmlFor="tx-amount">Amount · USD</label>
            <input
              id="tx-amount"
              name="amount"
              inputMode="decimal"
              defaultValue={
                transaction ? String(Math.abs(transaction.amount)) : ""
              }
              placeholder="0.00"
              required
            />
          </div>
          <div className={s.field}>
            <label htmlFor="tx-category">Category</label>
            <select
              id="tx-category"
              name="category"
              defaultValue={transaction?.category ?? "General"}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className={s.field}>
            <label htmlFor="tx-date">Date</label>
            <input
              id="tx-date"
              name="date"
              type="date"
              defaultValue={transaction?.date.slice(0, 10) ?? localDay()}
              min="2000-01-01"
              max="2099-12-31"
              required
            />
          </div>
          <label className="account-checkbox">
            <input
              name="recurring"
              type="checkbox"
              defaultChecked={transaction?.recurring}
            />
            Recurring expense
          </label>
          {(error || storageWarning) && (
            <p className={s.error} role="alert">
              {error || storageWarning}
            </p>
          )}
          <button className={`${s.primary} ${s.fullWidth}`}>
            {busy ? "Saving…" : "Save Transaction"}
          </button>
        </fieldset>
      </form>
    </dialog>
  );
}

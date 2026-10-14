import { useState } from "react";
import { useAccount } from "./account/Account";
import { useFinance } from "./store";
import { validStoredState } from "./finance";
export function AccountBar() {
  const { user, logout } = useAccount();
  const { month, dispatch, busy, refresh, openingBalance } = useFinance();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <div className="account-bar">
        <div>
          <strong>{user.name}'s finances</strong>
          <label htmlFor="reporting-month">Month</label>
          <input
            id="reporting-month"
            type="month"
            min="2000-01"
            max="2099-12"
            value={month}
            disabled={busy}
            onChange={(e) =>
              void dispatch({ type: "set-month", month: e.target.value })
            }
          />
          <span role="status">{busy ? "Saving…" : "All changes saved"}</span>
        </div>
        <div>
          <button disabled={busy} onClick={() => setEditing(!editing)}>
            Opening balance
          </button>
          <button disabled={busy} onClick={() => void refresh()}>
            Refresh records
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void logout().catch((e) => setError((e as Error).message))
            }
          >
            Sign out
          </button>
        </div>
      </div>
      {error && (
        <p className="server-message" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <>
          <form
            className="opening-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const amount = Number(
                new FormData(e.currentTarget).get("amount"),
              );
              if (await dispatch({ type: "set-opening", amount }))
                setEditing(false);
            }}
          >
            <label>
              Starting balance before recorded transactions
              <input
                name="amount"
                type="number"
                step="0.01"
                defaultValue={openingBalance}
                required
              />
            </label>
            <button disabled={busy}>Save opening balance</button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
          <div className="opening-form">
            <p>Import the earlier browser version into an empty account.</p>
            <button
              disabled={busy}
              onClick={() => {
                try {
                  const state = JSON.parse(
                    localStorage.getItem("personal-finance:v1") ?? "null",
                  );
                  if (!validStoredState(state))
                    throw new Error(
                      "No valid records from the earlier version were found in this browser.",
                    );
                  if (
                    window.confirm(
                      "Import the earlier budgets, savings and sample transaction history into this account?",
                    )
                  )
                    void dispatch({ type: "import-legacy", state });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Import browser records
            </button>
          </div>
        </>
      )}
    </>
  );
}

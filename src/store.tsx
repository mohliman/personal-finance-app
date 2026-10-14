import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./account/api";
import type { Action, FinanceState, Transaction } from "./types";
export type AccountAction =
  | Action
  | { type: "save-transaction"; transaction: Transaction }
  | { type: "delete-transaction"; id: string }
  | { type: "set-month"; month: string }
  | { type: "set-opening"; amount: number }
  | { type: "import-legacy"; state: FinanceState };
interface Snapshot {
  state: FinanceState;
  transactions: Transaction[];
  month: string;
  revision: number;
  openingBalance: number;
}
interface Context extends Snapshot {
  dispatch: (action: AccountAction) => Promise<boolean>;
  storageWarning: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
}
const FinanceContext = createContext<Context | null>(null);
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [storageWarning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      setSnapshot(await api<Snapshot>("/api/state"));
      setWarning(null);
    } catch (e) {
      setWarning((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function dispatch(action: AccountAction) {
    if (!snapshot || lock.current) {
      setWarning("Please wait for the current save to finish.");
      return false;
    }
    lock.current = true;
    setBusy(true);
    setWarning(null);
    try {
      setSnapshot(
        await api<Snapshot>("/api/actions", "POST", {
          action,
          revision: snapshot.revision,
        }),
      );
      return true;
    } catch (e) {
      setWarning(`Change not saved. ${(e as Error).message}`);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!snapshot)
    return (
      <main className="account-loading">
        <p role="status">{storageWarning || "Loading your finances…"}</p>
        <button disabled={busy} onClick={() => void refresh()}>
          Try again
        </button>
      </main>
    );
  return (
    <FinanceContext.Provider
      value={{ ...snapshot, dispatch, storageWarning, busy, refresh }}
    >
      {children}
    </FinanceContext.Provider>
  );
}
export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("FinanceProvider required");
  return context;
}

import { createContext, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { financeReducer, initialState, STORAGE_KEY, validStoredState } from './finance';
import type { Action, FinanceState } from './types';

const FinanceContext = createContext<{ state: FinanceState; dispatch: Dispatch<Action>; storageWarning: string | null } | null>(null);
function loadState(): { state: FinanceState; warning: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { state: initialState, warning: null };
    const parsed: unknown = JSON.parse(saved);
    if (validStoredState(parsed)) return { state: parsed, warning: null };
    return { state: initialState, warning: 'Your saved data could not be read. The original sample data has been loaded.' };
  } catch {
    return { state: initialState, warning: 'Browser storage is unavailable or unreadable. Changes may only last for this session.' };
  }
}
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(loadState);
  const [state, dispatch] = useReducer(financeReducer, loaded.state);
  const [storageWarning, setStorageWarning] = useState(loaded.warning);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { setStorageWarning('Changes are available in this session, but could not be saved to browser storage.'); }
  }, [state]);
  return <FinanceContext.Provider value={{ state, dispatch, storageWarning }}>{children}</FinanceContext.Provider>;
}
export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('FinanceProvider is required');
  return context;
}

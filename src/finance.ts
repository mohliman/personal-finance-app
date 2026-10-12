import sample from '../starter-code/data.json';
import type { Action, Bill, FinanceState, SortOrder, Transaction } from './types';

export const categories = ['Entertainment', 'Bills', 'Groceries', 'Dining Out', 'Transportation', 'Personal Care', 'Education', 'Lifestyle', 'Shopping', 'General'];
export const themes = [
  ['Green', '#277C78'], ['Yellow', '#F2CDAC'], ['Cyan', '#82C9D7'],
  ['Navy', '#626070'], ['Red', '#C94736'], ['Purple', '#826CB0'],
  ['Turquoise', '#597C7C'], ['Brown', '#93674F'], ['Magenta', '#934F6F'],
  ['Blue', '#3F82B2'], ['Navy Grey', '#97A0AC'], ['Army Green', '#7F9161'],
  ['Pink', '#AF81BA'], ['Gold', '#CAB361'], ['Orange', '#BE6C49'],
];
export const sortOrders: SortOrder[] = ['Latest', 'Oldest', 'A to Z', 'Z to A', 'Highest', 'Lowest'];
export const transactions: Transaction[] = sample.transactions;
export const initialState: FinanceState = {
  balance: sample.balance,
  budgets: sample.budgets.map((b, index) => ({ ...b, id: `budget-${index}` })),
  pots: sample.pots.map((p, index) => ({ ...p, id: `pot-${index}` })),
};
export const STORAGE_KEY = 'personal-finance:v1';
export const toCents = (amount: number) => Math.round(amount * 100);
export const roundMoney = (amount: number) => toCents(amount) / 100;
export const money = (amount: number, decimals = true) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0,
}).format(amount);
export const shortDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
export const inAppMonth = (date: string) => date.startsWith('2024-08');
export function spentFor(category: string, list = transactions) {
  return list.filter(t => t.category === category && t.amount < 0 && inAppMonth(t.date))
    .reduce((sum, t) => sum + toCents(-t.amount), 0) / 100;
}
export function sortTransactions<T extends Transaction>(list: T[], order: SortOrder, billMode = false): T[] {
  return [...list].sort((a, b) => {
    switch (order) {
      case 'A to Z': return a.name.localeCompare(b.name);
      case 'Z to A': return b.name.localeCompare(a.name);
      case 'Highest': return Math.abs(b.amount) - Math.abs(a.amount);
      case 'Lowest': return Math.abs(a.amount) - Math.abs(b.amount);
      default: {
        const difference = billMode
          ? new Date(a.date).getUTCDate() - new Date(b.date).getUTCDate()
          : Date.parse(b.date) - Date.parse(a.date);
        return order === 'Oldest' ? -difference : difference;
      }
    }
  });
}
export function latestForCategory(category: string, list = transactions) {
  return sortTransactions(list.filter(t => t.category === category), 'Latest').slice(0, 3);
}
export function getBills(list = transactions): Bill[] {
  const latest = Math.max(...list.map(t => Date.parse(t.date)));
  const today = new Date(latest).getUTCDate();
  const vendors = new Map<string, Transaction>();
  for (const item of sortTransactions(list.filter(t => t.recurring && t.amount < 0), 'Latest')) {
    if (!vendors.has(item.name)) vendors.set(item.name, item);
  }
  return Array.from(vendors.values()).map(t => {
    const day = new Date(t.date).getUTCDate();
    const paid = list.some(other => other.recurring && other.name === t.name && other.amount < 0 && inAppMonth(other.date));
    return { ...t, day, status: paid ? 'paid' : day >= today && day <= today + 5 ? 'due' : 'upcoming' };
  });
}
export function billSummary(bills = getBills()) {
  const summarize = (subset: Bill[]) => ({ count: subset.length, total: subset.reduce((sum, t) => sum + toCents(-t.amount), 0) / 100 });
  return {
    paid: summarize(bills.filter(t => t.status === 'paid')),
    upcoming: summarize(bills.filter(t => t.status !== 'paid')),
    due: summarize(bills.filter(t => t.status === 'due')),
    all: summarize(bills),
  };
}
export function ordinal(day: number) {
  return `${day}${day > 10 && day < 14 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'}`;
}
export function transferError(state: FinanceState, id: string, amount: number, direction: 'add' | 'withdraw'): string | null {
  const pot = state.pots.find(p => p.id === id);
  if (!pot) return 'This pot no longer exists.';
  if (!Number.isFinite(amount) || amount <= 0 || toCents(amount) === 0) return 'Enter an amount greater than $0.00.';
  if (Math.abs(amount - roundMoney(amount)) > 0.000001) return 'Use no more than two decimal places.';
  if (direction === 'add' && toCents(amount) > toCents(state.balance.current)) return `You can add up to ${money(state.balance.current)} from your balance.`;
  if (direction === 'withdraw' && toCents(amount) > toCents(pot.total)) return `You can withdraw up to ${money(pot.total)} from this pot.`;
  return null;
}
export function financeReducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case 'save-budget': {
      if (!categories.includes(action.budget.category) || !Number.isFinite(action.budget.maximum) || action.budget.maximum <= 0
        || state.budgets.some(b => b.id !== action.budget.id && b.category === action.budget.category)) return state;
      return { ...state, budgets: state.budgets.some(b => b.id === action.budget.id)
        ? state.budgets.map(b => b.id === action.budget.id ? action.budget : b) : [...state.budgets, action.budget] };
    }
    case 'delete-budget': return { ...state, budgets: state.budgets.filter(b => b.id !== action.id) };
    case 'save-pot': {
      if (!action.pot.name.trim() || !Number.isFinite(action.pot.target) || action.pot.target <= 0) return state;
      const existing = state.pots.find(p => p.id === action.pot.id);
      const pot = { ...action.pot, total: existing?.total ?? 0 };
      return { ...state, pots: existing ? state.pots.map(p => p.id === pot.id ? pot : p) : [...state.pots, pot] };
    }
    case 'delete-pot': {
      const pot = state.pots.find(p => p.id === action.id);
      if (!pot) return state;
      return { ...state, balance: { ...state.balance, current: roundMoney(state.balance.current + pot.total) }, pots: state.pots.filter(p => p.id !== action.id) };
    }
    case 'transfer': {
      if (transferError(state, action.id, action.amount, action.direction)) return state;
      const delta = action.direction === 'add' ? action.amount : -action.amount;
      return { ...state, balance: { ...state.balance, current: roundMoney(state.balance.current - delta) },
        pots: state.pots.map(p => p.id === action.id ? { ...p, total: roundMoney(p.total + delta) } : p) };
    }
  }
}
export function validStoredState(value: unknown): value is FinanceState {
  if (!value || typeof value !== 'object') return false;
  const s = value as FinanceState;
  const validMoney = (n: number) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && Number.isSafeInteger(toCents(n));
  const validTheme = (theme: string) => themes.some(t => t[1] === theme);
  return !!s.balance && [s.balance.current, s.balance.income, s.balance.expenses].every(validMoney)
    && Array.isArray(s.budgets) && s.budgets.every(b => typeof b.id === 'string' && categories.includes(b.category) && validMoney(b.maximum) && b.maximum > 0 && validTheme(b.theme))
    && new Set(s.budgets.map(b => b.id)).size === s.budgets.length && new Set(s.budgets.map(b => b.category)).size === s.budgets.length
    && Array.isArray(s.pots) && s.pots.every(p => typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 30 && validMoney(p.target) && p.target > 0 && validMoney(p.total) && validTheme(p.theme))
    && new Set(s.pots.map(p => p.id)).size === s.pots.length;
}

import { describe, expect, it } from 'vitest';
import { billSummary, financeReducer, getBills, initialState, latestForCategory, sortTransactions, spentFor, transferError, transactions, validStoredState } from './finance';
import type { Transaction } from './types';

describe('budget spending', () => {
  it('counts only August expenses, excluding income and earlier months', () => {
    const list: Transaction[] = [
      { ...transactions[0], category: 'Bills', amount: -10.1, date: '2024-08-01T00:00:00Z' },
      { ...transactions[0], category: 'Bills', amount: -20.2, date: '2024-08-31T23:00:00Z' },
      { ...transactions[0], category: 'Bills', amount: 40, date: '2024-08-01T00:00:00Z' },
      { ...transactions[0], category: 'Bills', amount: -100, date: '2024-07-31T23:00:00Z' },
    ];
    expect(spentFor('Bills', list)).toBe(30.3);
    expect(spentFor('Groceries', list)).toBe(0);
  });
  it('rejects duplicate budget categories without modifying the state', () => {
    expect(financeReducer(initialState, { type: 'save-budget', budget: { ...initialState.budgets[0], id: 'duplicate' } })).toBe(initialState);
  });
  it('shows the latest three category transactions across months, including income', () => {
    const list = latestForCategory('General');
    expect(list).toHaveLength(3);
    expect(list[0].name).toBe('Emma Richardson');
    expect(list[0].amount).toBe(75.5);
    expect(latestForCategory('Entertainment').some(t => t.date.startsWith('2024-07'))).toBe(true);
  });
});
describe('pot transfers', () => {
  const id = initialState.pots[0].id;
  it('keeps balance plus savings constant through additions and withdrawals', () => {
    const add = financeReducer(initialState, { type: 'transfer', id, amount: 100.25, direction: 'add' });
    expect(add.balance.current).toBe(4735.75);
    expect(add.pots[0].total).toBe(259.25);
    const withdraw = financeReducer(add, { type: 'transfer', id, amount: 100.25, direction: 'withdraw' });
    expect(withdraw).toEqual(initialState);
  });
  it('rejects overdrafts, overwithdrawals, zero, negative, nonfinite, and subcent amounts', () => {
    for (const amount of [4836.01, 0, -1, NaN, Infinity, 0.001, 1.234]) {
      expect(transferError(initialState, id, amount, 'add')).toBeTruthy();
      expect(financeReducer(initialState, { type: 'transfer', id, amount, direction: 'add' })).toBe(initialState);
    }
    expect(financeReducer(initialState, { type: 'transfer', id, amount: 159.01, direction: 'withdraw' })).toBe(initialState);
  });
  it('allows withdrawing the exact total and never changes the source state', () => {
    const after = financeReducer(initialState, { type: 'transfer', id, amount: 159, direction: 'withdraw' });
    expect(after.pots[0].total).toBe(0);
    expect(initialState.pots[0].total).toBe(159);
  });
  it('returns the entire saved amount when deleting, exactly once', () => {
    const after = financeReducer(initialState, { type: 'delete-pot', id });
    expect(after.balance.current).toBe(4995);
    expect(after.pots).toHaveLength(4);
    expect(financeReducer(after, { type: 'delete-pot', id })).toBe(after);
  });
  it('retains savings when editing a pot', () => {
    const after = financeReducer(initialState, { type: 'save-pot', pot: { ...initialState.pots[0], name: 'Updated', total: 0, target: 500 } });
    expect(after.pots[0].total).toBe(159);
    expect(after.balance).toEqual(initialState.balance);
  });
});
describe('recurring bills', () => {
  it('deduplicates vendors and classifies the supplied data', () => {
    const bills = getBills();
    expect(bills).toHaveLength(8);
    expect(new Set(bills.map(b => b.name)).size).toBe(8);
    expect(bills.find(b => b.name === 'Elevate Education')?.day).toBe(4);
    expect(billSummary()).toEqual({ paid: { count: 4, total: 190 }, upcoming: { count: 4, total: 194.98 }, due: { count: 2, total: 59.98 }, all: { count: 8, total: 384.98 } });
  });
  it('includes the five-day due boundary and excludes overdue dates', () => {
    const t = transactions[0];
    const list = [
      { ...t, date: '2024-08-19T00:00:00Z' },
      ...[18, 19, 24, 25].map(day => ({ ...t, name: `Vendor ${day}`, date: `2024-07-${day}T00:00:00Z`, amount: -1, recurring: true })),
    ];
    expect(getBills(list).filter(b => b.status === 'due').map(b => b.day).sort()).toEqual([19, 24]);
  });
  it('sorts Latest by earliest payment day, independently of month', () => {
    const bills = sortTransactions(getBills(), 'Latest', true);
    expect(bills.map(b => b.day)).toEqual([2, 3, 4, 11, 21, 23, 29, 30]);
  });
});
describe('transaction ordering and persistence', () => {
  it('sorts amounts by magnitude and does not mutate transactions', () => {
    const source = [transactions[0], transactions[1]];
    expect(sortTransactions(source, 'Highest')[0].amount).toBe(75.5);
    expect(sortTransactions(source, 'Lowest')[0].amount).toBe(-55.5);
    expect(source[0]).toBe(transactions[0]);
  });
  it('accepts valid state and rejects corrupt records', () => {
    expect(validStoredState(initialState)).toBe(true);
    expect(validStoredState({ ...initialState, balance: { ...initialState.balance, current: -1 } })).toBe(false);
    expect(validStoredState({ ...initialState, pots: [{ ...initialState.pots[0], total: '159' }] })).toBe(false);
    expect(validStoredState({ ...initialState, budgets: [...initialState.budgets, initialState.budgets[0]] })).toBe(false);
    expect(validStoredState({ ...initialState, budgets: [null] })).toBe(false);
    expect(validStoredState({ ...initialState, pots: [null] })).toBe(false);
    expect(validStoredState(null)).toBe(false);
  });
});

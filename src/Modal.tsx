import { useEffect, useRef, useState, type FormEvent } from 'react';
import { categories, money, themes, transferError } from './finance';
import { Icon, Progress } from './components';
import { useFinance } from './store';
import type { Budget, Pot } from './types';
import s from './App.module.css';

export type ModalState =
  | { kind: 'budget'; item?: Budget }
  | { kind: 'pot'; item?: Pot }
  | { kind: 'delete-budget'; item: Budget }
  | { kind: 'delete-pot'; item: Pot }
  | { kind: 'add' | 'withdraw'; item: Pot };
export function FinanceModal({ modal, onClose, onSuccess }: { modal: ModalState; onClose: () => void; onSuccess: (message: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      else document.getElementById('page-title')?.focus({ preventScroll: true });
    };
  }, []);
  const isDelete = modal.kind.startsWith('delete');
  const title = modal.kind === 'budget' ? modal.item ? 'Edit Budget' : 'Add New Budget'
    : modal.kind === 'pot' ? modal.item ? 'Edit Pot' : 'Add New Pot'
    : isDelete ? `Delete '${'name' in modal.item! ? modal.item.name : modal.item!.category}'?`
    : `${modal.kind === 'add' ? 'Add to' : 'Withdraw from'} '${(modal.item as Pot).name}'`;
  return <dialog ref={ref} className={s.dialog} aria-labelledby="dialog-title" aria-describedby="dialog-description"
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) { const r = ref.current!.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className={s.modalHeading}><h2 id="dialog-title">{title}</h2><button className={s.iconButton} aria-label="Close dialog" onClick={onClose}><Icon name="close-modal" /></button></div>
    {modal.kind === 'budget' || modal.kind === 'pot' ? <EditForm modal={modal} onSuccess={onSuccess} />
      : modal.kind === 'delete-budget' || modal.kind === 'delete-pot' ? <DeleteForm modal={modal} onClose={onClose} onSuccess={onSuccess} />
      : <TransferForm modal={modal as { kind: 'add' | 'withdraw'; item: Pot }} onSuccess={onSuccess} />}
  </dialog>;
}
function EditForm({ modal, onSuccess }: { modal: Extract<ModalState, { kind: 'budget' | 'pot' }>; onSuccess: (message: string) => void }) {
  const { state, dispatch } = useFinance();
  const isBudget = modal.kind === 'budget';
  const usedCategories = state.budgets.filter(b => b.id !== modal.item?.id).map(b => b.category);
  const [name, setName] = useState(modal.item ? ('category' in modal.item ? modal.item.category : modal.item.name) : isBudget ? categories.find(c => !usedCategories.includes(c)) ?? '' : '');
  const [amount, setAmount] = useState(modal.item ? String('maximum' in modal.item ? modal.item.maximum : modal.item.target) : '');
  const usedThemes = (isBudget ? state.budgets : state.pots).filter(item => item.id !== modal.item?.id).map(item => item.theme);
  const [theme, setTheme] = useState(modal.item?.theme ?? themes.find(t => !usedThemes.includes(t[1]))?.[1] ?? themes[0][1]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = isBudget ? 'Choose a category.' : 'Enter a pot name.';
    else if (!isBudget && name.trim().length > 30) next.name = 'Use 30 characters or fewer.';
    else if (!isBudget && state.pots.some(p => p.id !== modal.item?.id && p.name.toLowerCase() === name.trim().toLowerCase())) next.name = 'A pot with this name already exists.';
    else if (isBudget && usedCategories.includes(name)) next.name = 'This category already has a budget.';
    if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) next.amount = 'Enter an amount greater than $0.00.';
    else if (!/^\d+(\.\d{1,2})?$/.test(amount)) next.amount = 'Enter a valid amount with up to two decimal places.';
    else if (Number(amount) > 1_000_000_000) next.amount = 'Enter an amount up to $1,000,000,000.';
    setErrors(next);
    if (Object.keys(next).length) { requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    const id = modal.item?.id ?? crypto.randomUUID();
    if (isBudget) dispatch({ type: 'save-budget', budget: { id, category: name, maximum: Number(amount), theme } });
    else dispatch({ type: 'save-pot', pot: { id, name: name.trim(), target: Number(amount), total: 0, theme } });
    onSuccess(`${name.trim()} ${isBudget ? 'budget' : 'pot'} ${modal.item ? 'updated' : 'created'}.`);
  }
  return <form ref={formRef} onSubmit={submit} noValidate>
    <p id="dialog-description" className={s.modalDescription}>{isBudget ? modal.item ? 'As your budgets change, feel free to update your spending limits.' : 'Choose a category to set a spending budget. These categories can help you monitor spending.'
      : modal.item ? 'If your saving targets change, feel free to update your pots.' : 'Create a pot to set savings targets. These can help keep you on track as you save for special purchases.'}</p>
    <div className={s.field}><label htmlFor="entry-name">{isBudget ? 'Budget Category' : 'Pot Name'}</label>
      {isBudget ? <select id="entry-name" data-initial-focus value={name} onChange={e => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined}>
        {categories.map(category => <option key={category} value={category} disabled={usedCategories.includes(category)}>{category}{usedCategories.includes(category) ? ' (already used)' : ''}</option>)}</select>
        : <input id="entry-name" data-initial-focus placeholder="e.g. Rainy Days" maxLength={30} value={name} onChange={e => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : 'name-hint'} />}
      {errors.name && <p className={s.error} id="name-error">{errors.name}</p>}{!isBudget && <span id="name-hint" className={s.fieldHint}>{30 - name.length} characters left</span>}
    </div>
    <MoneyField id="entry-amount" label={isBudget ? 'Maximum Spend' : 'Target'} value={amount} onChange={setAmount} error={errors.amount} />
    <div className={s.field}><label htmlFor="entry-theme">Theme</label><div className={s.themeSelect}><span style={{ background: theme }} aria-hidden="true" /><select id="entry-theme" value={theme} onChange={e => setTheme(e.target.value)}>
      {themes.map(([label, color]) => <option key={color} value={color}>{label}{usedThemes.includes(color) ? ' (already used)' : ''}</option>)}
    </select></div></div>
    <button className={`${s.primary} ${s.fullWidth}`} type="submit">{modal.item ? 'Save Changes' : isBudget ? 'Add Budget' : 'Add Pot'}</button>
  </form>;
}
function DeleteForm({ modal, onClose, onSuccess }: { modal: Extract<ModalState, { kind: 'delete-budget' | 'delete-pot' }>; onClose: () => void; onSuccess: (message: string) => void }) {
  const { dispatch } = useFinance();
  const isPot = modal.kind === 'delete-pot';
  const name = isPot ? modal.item.name : modal.item.category;
  return <><p id="dialog-description" className={s.modalDescription}>Are you sure you want to delete this {isPot ? 'pot' : 'budget'}? This action cannot be reversed.{isPot ? ` The ${money(modal.item.total)} saved will be returned to your current balance.` : ' Your transaction history will be retained.'}</p>
    <button className={`${s.danger} ${s.fullWidth}`} onClick={() => { dispatch({ type: isPot ? 'delete-pot' : 'delete-budget', id: modal.item.id }); onSuccess(`${name} ${isPot ? 'pot' : 'budget'} deleted.`); }}>Yes, Confirm Deletion</button>
    <button data-initial-focus className={`${s.cancel} ${s.fullWidth}`} onClick={onClose}>No, Go Back</button></>;
}
function MoneyField({ id, label, value, onChange, error, autoFocus = false }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean }) {
  return <div className={s.field}><label htmlFor={id}>{label}</label><div className={s.moneyInput}><span aria-hidden="true">$</span><input id={id} data-initial-focus={autoFocus ? '' : undefined} inputMode="decimal" placeholder="e.g. 100.00" value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /></div>{error && <p id={`${id}-error`} className={s.error}>{error}</p>}</div>;
}
function TransferForm({ modal, onSuccess }: { modal: { kind: 'add' | 'withdraw'; item: Pot }; onSuccess: (message: string) => void }) {
  const { state, dispatch } = useFinance();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>();
  const pot = state.pots.find(p => p.id === modal.item.id) ?? modal.item;
  const adding = modal.kind === 'add';
  const proposed = Math.max(0, pot.total + (adding ? 1 : -1) * (Number.isFinite(Number(amount)) ? Number(amount) : 0));
  function submit(event: FormEvent) {
    event.preventDefault();
    const message = transferError(state, pot.id, Number(amount), modal.kind);
    if (message || !/^\d+(\.\d{1,2})?$/.test(amount)) { setError(message ?? 'Enter a valid amount with up to two decimal places.'); requestAnimationFrame(() => document.getElementById('transfer-amount')?.focus()); return; }
    dispatch({ type: 'transfer', id: pot.id, amount: Number(amount), direction: modal.kind });
    onSuccess(`${money(Number(amount))} ${adding ? 'added to' : 'withdrawn from'} ${pot.name}.`);
  }
  return <form onSubmit={submit} noValidate><p id="dialog-description" className={s.modalDescription}>{adding ? 'Add money to your pot to keep it separate from your main balance. As soon as you add this money, it will be deducted from your current balance.' : 'Withdraw from your pot to put money back in your main balance. This will reduce the amount you have in this pot.'}</p>
    <div className={s.potTotal}><span>New Amount</span><strong>{money(proposed)}</strong></div>
    <Progress value={proposed} maximum={pot.target} color={adding ? '#277C78' : '#C94736'} label={`${pot.name} after ${adding ? 'addition' : 'withdrawal'}`} />
    <div className={s.progressCaption}><strong>{(proposed / pot.target * 100).toFixed(2)}%</strong><span>Target of {money(pot.target, false)}</span></div>
    <p className={s.available}>Available {adding ? 'balance' : 'in pot'}: {money(adding ? state.balance.current : pot.total)}</p>
    <MoneyField id="transfer-amount" label={adding ? 'Amount to Add' : 'Amount to Withdraw'} value={amount} onChange={setAmount} error={error} autoFocus />
    <button className={`${s.primary} ${s.fullWidth}`} type="submit">{adding ? 'Confirm Addition' : 'Confirm Withdrawal'}</button>
  </form>;
}

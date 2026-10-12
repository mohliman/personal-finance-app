import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { money, shortDate, sortOrders } from './finance';
import type { SortOrder, Transaction } from './types';
import s from './App.module.css';

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`${s.icon} ${className}`} style={{ '--icon': `url('/assets/images/icon-${name}.svg')` } as CSSProperties} />;
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`${s.card} ${className}`}>{children}</section>;
}
export function SectionHeading({ title, to, linkLabel = 'See Details' }: { title: string; to: string; linkLabel?: string }) {
  return <div className={s.sectionHeading}><h2>{title}</h2><Link className={s.textLink} to={to} aria-label={`${linkLabel}: ${title}`}>{linkLabel}<Icon name="caret-right" /></Link></div>;
}
export function PageHeading({ title, action, actionLabel, disabled }: { title: string; action?: () => void; actionLabel?: string; disabled?: boolean }) {
  return <header className={s.pageHeading}><h1 tabIndex={-1} id="page-title">{title}</h1>{action && <button className={s.primary} onClick={action} disabled={disabled}>{actionLabel}</button>}</header>;
}
export function ColorLabel({ title, amount, color }: { title: string; amount: string; color: string }) {
  return <div className={s.colorLabel} style={{ '--accent': color } as CSSProperties}><span>{title}</span><strong>{amount}</strong></div>;
}
export function Progress({ value, maximum, color, label }: { value: number; maximum: number; color: string; label: string }) {
  return <div className={s.progress} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={Math.min(value, maximum)} aria-valuetext={`${money(value)} of ${money(maximum)}`}><span style={{ width: `${Math.min(100, Math.max(0, value / maximum * 100))}%`, background: color }} /></div>;
}
export function Avatar({ transaction }: { transaction: Transaction }) {
  return <img className={s.avatar} src={transaction.avatar.replace('./assets/', '/assets/')} alt="" width="40" height="40" />;
}
export function TransactionList({ list, compact = false }: { list: Transaction[]; compact?: boolean }) {
  return <ul className={`${s.transactionList} ${compact ? s.compact : ''}`}>{list.map((t, i) => <li key={`${t.date}-${t.name}-${i}`}>
    <div className={s.recipient}><Avatar transaction={t} /><strong>{t.name}</strong></div>
    <div className={s.transactionValue}><strong className={t.amount > 0 ? s.positive : ''}>{t.amount > 0 ? '+' : '-'}{money(Math.abs(t.amount))}</strong><span>{shortDate(t.date)}</span></div>
  </li>)}</ul>;
}
export function Search({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className={s.search}><input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} /><Icon name="search" /></div>;
}
export function SortSelect({ value, onChange }: { value: SortOrder; onChange: (value: SortOrder) => void }) {
  return <label className={`${s.filterLabel} ${s.sortFilter}`}><span>Sort by</span><Icon name="sort-mobile" /><select aria-label="Sort by" value={value} onChange={e => onChange(e.target.value as SortOrder)}>{sortOrders.map(order => <option key={order}>{order}</option>)}</select></label>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className={s.empty} role="status">{children}</p>;
}
export function ActionMenu({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && ref.current) ref.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && ref.current?.open) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); event.stopPropagation(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  function act(callback: () => void) {
    if (ref.current) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); }
    callback();
  }
  return <details className={s.actionMenu} ref={ref}><summary aria-label={`Actions for ${name}`}><Icon name="ellipsis" /></summary><div className={s.menuItems}>
    <button onClick={() => act(onEdit)}>Edit {name}</button><button className={s.deleteText} onClick={() => act(onDelete)}>Delete {name}</button>
  </div></details>;
}

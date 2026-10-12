import type { CSSProperties } from 'react';
import { ActionMenu, Card, ColorLabel, Empty, PageHeading, Progress, SectionHeading, TransactionList } from '../components';
import { categories, latestForCategory, money, spentFor } from '../finance';
import { useFinance } from '../store';
import type { Budget } from '../types';
import type { ModalState } from '../Modal';
import s from '../App.module.css';

export function BudgetChart({ budgets }: { budgets: Budget[] }) {
  const limit = budgets.reduce((sum, b) => sum + b.maximum, 0);
  const spent = budgets.reduce((sum, b) => sum + spentFor(b.category), 0);
  let offset = 0;
  const stops = budgets.map(b => { const start = offset; offset += (spent > 0 ? spentFor(b.category) / spent : b.maximum / limit) * 100; return `${b.theme} ${start}% ${offset}%`; });
  return <div className={s.donut} style={{ background: `conic-gradient(${stops.join(', ')})` }} role="img" aria-label={`${money(spent)} spent across budgets with a total limit of ${money(limit)}`}><div><strong>{money(spent, false)}</strong><span>of {money(limit, false)} limit</span></div></div>;
}
export default function Budgets({ openModal }: { openModal: (modal: ModalState) => void }) {
  const { state } = useFinance();
  return <><PageHeading title="Budgets" actionLabel="+ Add New Budget" action={() => openModal({ kind: 'budget' })} disabled={state.budgets.length >= categories.length} />
    {state.budgets.length ? <div className={s.budgetsLayout}><Card className={s.budgetSummary}><BudgetChart budgets={state.budgets} /><h2>Spending Summary</h2><div className={s.spendingSummary}>
      {state.budgets.map(b => <div key={b.id}><ColorLabel title={b.category} amount="" color={b.theme} /><p><strong>{money(spentFor(b.category))}</strong><span> of {money(b.maximum)}</span></p></div>)}
    </div></Card><div className={s.budgetCards}>{state.budgets.map(budget => {
      const spent = spentFor(budget.category);
      const latest = latestForCategory(budget.category);
      return <Card key={budget.id}><div className={s.itemHeading}><h2><span className={s.colorDot} style={{ background: budget.theme }} />{budget.category}</h2><ActionMenu name={budget.category} onEdit={() => openModal({ kind: 'budget', item: budget })} onDelete={() => openModal({ kind: 'delete-budget', item: budget })} /></div>
        <p className={s.budgetMaximum}>Maximum of {money(budget.maximum)}</p><Progress value={spent} maximum={budget.maximum} color={budget.theme} label={`${budget.category} budget spending`} />
        <div className={s.budgetAmounts}><ColorLabel title="Spent" amount={money(spent)} color={budget.theme} /><ColorLabel title="Remaining" amount={money(Math.max(0, budget.maximum - spent))} color="#F8F4F0" /></div>
        {spent > budget.maximum && <p className={s.overBudget} style={{ '--accent': budget.theme } as CSSProperties}>{money(spent - budget.maximum)} over budget</p>}
        <div className={s.latestSpending}><SectionHeading title="Latest Spending" to={`/transactions?category=${encodeURIComponent(budget.category)}`} linkLabel="See All" />{latest.length ? <TransactionList list={latest} compact /> : <Empty>No spending in this category yet.</Empty>}</div>
      </Card>;
    })}</div></div> : <Card><Empty>No budgets yet. Add your first budget to monitor your monthly spending.</Empty></Card>}
  </>;
}

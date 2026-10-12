import { billSummary, money, spentFor, transactions } from '../finance';
import { Card, ColorLabel, Empty, Icon, PageHeading, SectionHeading, TransactionList } from '../components';
import { useFinance } from '../store';
import { BudgetChart } from './Budgets';
import s from '../App.module.css';

export default function Overview() {
  const { state } = useFinance();
  const summary = billSummary();
  const saved = state.pots.reduce((sum, pot) => sum + Math.round(pot.total * 100), 0) / 100;
  return <><PageHeading title="Overview" />
    <div className={s.balanceGrid}>{[['Current Balance', state.balance.current], ['Income', state.balance.income], ['Expenses', state.balance.expenses]].map(([title, value], i) => <section key={title} className={`${s.balanceCard} ${i === 0 ? s.dark : ''}`} aria-label={String(title)}><span>{title}</span><strong>{money(Number(value))}</strong></section>)}</div>
    <div className={s.overviewGrid}><div className={s.overviewColumn}>
      <Card><SectionHeading title="Pots" to="/pots" /><div className={s.potsSummary}>
        <div className={s.totalSaved}><Icon name="pot" /><div><span>Total Saved</span><strong>{money(saved, false)}</strong></div></div>
        <div className={s.miniGrid}>{state.pots.slice(0, 4).map(pot => <ColorLabel key={pot.id} title={pot.name} amount={money(pot.total, false)} color={pot.theme} />)}</div>
      </div>{!state.pots.length && <Empty>No pots yet. Create a pot to start saving.</Empty>}</Card>
      <Card><SectionHeading title="Transactions" to="/transactions" linkLabel="View All" /><TransactionList list={transactions.slice(0, 5)} /></Card>
    </div><div className={s.overviewColumn}>
      <Card><SectionHeading title="Budgets" to="/budgets" />{state.budgets.length ? <div className={s.overviewBudget}><BudgetChart budgets={state.budgets} /><div className={s.budgetLegend}>{state.budgets.map(b => <ColorLabel key={b.id} title={b.category} amount={money(b.maximum)} color={b.theme} />)}</div></div> : <Empty>No budgets yet. Set a spending limit to get started.</Empty>}
        <span className={s.srOnly}>Budget spending: {state.budgets.map(b => `${b.category}: ${money(spentFor(b.category))} of ${money(b.maximum)}`).join('; ')}</span>
      </Card>
      <Card><SectionHeading title="Recurring Bills" to="/recurring-bills" /><div className={s.billTiles}>
        <div style={{ borderColor: '#277C78' }}><span>Paid Bills</span><strong>{money(summary.paid.total)}</strong></div>
        <div style={{ borderColor: '#F2CDAC' }}><span>Total Upcoming</span><strong>{money(summary.upcoming.total)}</strong></div>
        <div style={{ borderColor: '#82C9D7' }}><span>Due Soon</span><strong>{money(summary.due.total)}</strong></div>
      </div></Card>
    </div></div>
  </>;
}

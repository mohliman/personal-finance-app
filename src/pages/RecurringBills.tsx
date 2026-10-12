import { useState } from 'react';
import { Avatar, Card, Empty, Icon, PageHeading, Search, SortSelect } from '../components';
import { billSummary, getBills, money, ordinal, sortTransactions } from '../finance';
import type { SortOrder } from '../types';
import s from '../App.module.css';

export default function RecurringBills() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOrder>('Latest');
  const bills = getBills();
  const summary = billSummary(bills);
  const visible = sortTransactions(bills.filter(t => t.name.toLowerCase().includes(search.toLowerCase().trim())), sort, true);
  return <><PageHeading title="Recurring Bills" /><div className={s.billsLayout}><div className={s.billsAside}>
    <section className={`${s.totalBills} ${s.dark}`}><Icon name="recurring-bills" /><div><span>Total Bills</span><strong>{money(summary.all.total)}</strong></div></section>
    <Card className={s.billSummary}><h2>Summary</h2>{[['Paid Bills', summary.paid], ['Total Upcoming', summary.upcoming], ['Due Soon', summary.due]].map(([title, value], i) => {
      const item = value as { count: number; total: number };
      return <div key={String(title)} className={i === 2 ? s.dueText : ''}><span>{String(title)}</span><strong>{item.count} ({money(item.total)})</strong></div>;
    })}</Card>
  </div><Card className={s.billsCard}><div className={s.toolbar}><Search value={search} onChange={setSearch} placeholder="Search bills" /><SortSelect value={sort} onChange={setSort} /></div>
    <table className={s.billsTable}><caption className={s.srOnly}>Recurring bills for August 2024. Due soon is based on 19 August 2024.</caption><thead><tr><th scope="col">Bill Title</th><th scope="col">Due Date</th><th scope="col">Amount</th></tr></thead><tbody>{visible.map(bill => <tr key={bill.name}><td><div className={s.recipient}><Avatar transaction={bill} /><strong>{bill.name}</strong></div></td><td><span className={bill.status === 'paid' ? s.positive : bill.status === 'due' ? s.dueText : ''}>Monthly-{ordinal(bill.day)} {bill.status !== 'upcoming' && <Icon name={bill.status === 'paid' ? 'bill-paid' : 'bill-due'} />}<span className={s.srOnly}> — {bill.status === 'paid' ? 'Paid' : bill.status === 'due' ? 'Due soon' : 'Upcoming'}</span></span></td><td className={bill.status === 'due' ? s.dueText : ''}><strong>{money(Math.abs(bill.amount))}</strong></td></tr>)}</tbody></table>
    {!visible.length && <Empty>No bills match your search. Try another name.</Empty>}
    <p className={s.resultCount} role="status">{visible.length} recurring {visible.length === 1 ? 'bill' : 'bills'}</p>
  </Card></div></>;
}

import { ActionMenu, Card, Empty, PageHeading, Progress } from '../components';
import { money } from '../finance';
import { useFinance } from '../store';
import type { ModalState } from '../Modal';
import s from '../App.module.css';

export default function Pots({ openModal }: { openModal: (modal: ModalState) => void }) {
  const { state } = useFinance();
  return <><PageHeading title="Pots" actionLabel="+ Add New Pot" action={() => openModal({ kind: 'pot' })} />
    <div className={s.potsGrid}>{state.pots.map(pot => <Card key={pot.id}>
      <div className={s.itemHeading}><h2><span className={s.colorDot} style={{ background: pot.theme }} />{pot.name}</h2><ActionMenu name={pot.name} onEdit={() => openModal({ kind: 'pot', item: pot })} onDelete={() => openModal({ kind: 'delete-pot', item: pot })} /></div>
      <div className={s.potTotal}><span>Total Saved</span><strong>{money(pot.total)}</strong></div><Progress value={pot.total} maximum={pot.target} color={pot.theme} label={`${pot.name} savings progress`} />
      <div className={s.progressCaption}><strong>{(pot.total / pot.target * 100).toFixed(2)}%</strong><span>Target of {money(pot.target, false)}</span></div>
      <div className={s.potButtons}><button className={s.secondary} onClick={() => openModal({ kind: 'add', item: pot })} aria-label={`Add money to ${pot.name}`}>+ Add Money</button><button className={s.secondary} onClick={() => openModal({ kind: 'withdraw', item: pot })} aria-label={`Withdraw money from ${pot.name}`}>Withdraw</button></div>
    </Card>)}</div>{!state.pots.length && <Card><Empty>No pots yet. Create your first pot and set a savings target.</Empty></Card>}
  </>;
}

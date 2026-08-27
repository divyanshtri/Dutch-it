import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api';
import Avatar from './Avatar';
import GhostBadge from './GhostBadge';

function PublicSummary({ shareToken }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/public/summary/${encodeURIComponent(shareToken)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Summary unavailable.');
        setData(body);
      })
      .catch((loadError) => setError(loadError.message));
  }, [shareToken]);

  if (error) return <main className="public-summary"><p className="status-text status-text--error">{error}</p></main>;
  if (!data) return <main className="public-summary"><p className="status-text">Loading shared summary…</p></main>;
  const members = Object.fromEntries(data.group.members.map((member) => [member._id, member]));

  return <main className="public-summary">
    <div className="public-summary__banner">Paid your share? Download Dutch-it to settle up directly.</div>
    <header className="public-summary__hero">
      <span className="universal-parser__eyebrow">Shared read-only summary</span>
      <h1>{data.group.name}</h1><strong>₹{data.total.toFixed(2)}</strong>
    </header>
    <section className="universal-card">
      <h2 className="subsection-title">Members</h2>
      <div className="members-row">{data.group.members.map((member) => <span className="member-chip" key={member._id}>
        <Avatar user={member} size={24} /> {member.fullName} {member.isGhost && <GhostBadge />}
      </span>)}</div>
    </section>
    <section className="universal-card">
      <h2 className="subsection-title">Owed Balances</h2>
      {!data.balances.length ? <p className="status-text">Everyone is settled up.</p> : <div className="balances-list">{data.balances.map((balance, index) => <div className="balance-row" key={index}>
        <span>{members[balance.owes]?.fullName} owes {members[balance.owedTo]?.fullName}</span><strong>₹{balance.amount.toFixed(2)}</strong>
      </div>)}</div>}
    </section>
    <section className="public-expenses">
      <h2 className="subsection-title">Expenses</h2>
      {data.expenses.map((expense) => <article className="universal-card public-expense" key={expense._id}>
        <div className="public-expense__header"><div><h3>{expense.description}</h3><span>Paid by {expense.paidBy?.fullName || 'Unknown'}</span></div><strong>₹{expense.totalAmount.toFixed(2)}</strong></div>
        {expense.lineItems?.length > 0 && <div className="universal-table-wrap"><table className="universal-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>
          {expense.lineItems.map((item, index) => <tr key={index}><td>{item.itemName}</td><td>{item.quantity}</td><td>₹{item.price.toFixed(2)}</td><td>₹{(item.price * item.quantity).toFixed(2)}</td></tr>)}
        </tbody></table></div>}
        {expense.splits?.length > 0 && <div className="public-expense__splits">{expense.splits.map((split) => <span key={split.user}>{members[split.user]?.fullName || 'Member'}: ₹{split.amount.toFixed(2)}</span>)}</div>}
      </article>)}
    </section>
    <div className="public-summary__banner">Paid your share? Download Dutch-it to settle up directly.</div>
  </main>;
}

export default PublicSummary;

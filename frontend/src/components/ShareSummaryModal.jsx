import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api';

function ShareSummaryModal({ groupId, onClose }) {
  const [summary, setSummary] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    async function prepareShare() {
      try {
        const tokenResponse = await fetch(`${API_BASE_URL}/api/groups/${groupId}/share`, {
          method: 'POST', credentials: 'include',
        });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) throw new Error(tokenData.message || 'Could not create share link.');
        const url = `${window.location.origin}/s/${tokenData.shareToken}`;
        setShareUrl(url);
        const summaryResponse = await fetch(`${API_BASE_URL}/api/public/summary/${tokenData.shareToken}`);
        const summaryData = await summaryResponse.json();
        if (!summaryResponse.ok) throw new Error(summaryData.message || 'Could not load summary.');
        setSummary(summaryData);
      } catch (shareError) { setError(shareError.message); }
    }
    prepareShare();
  }, [groupId]);

  async function copy(text, type) {
    try { await navigator.clipboard.writeText(text); setCopied(type); }
    catch { setError('Could not access the clipboard.'); }
  }

  function whatsappText() {
    if (!summary) return '';
    const names = Object.fromEntries(summary.group.members.map((member) => [member._id, member]));
    const lines = summary.balances.map((balance) => {
      const debtor = names[balance.owes];
      const creditor = names[balance.owedTo];
      return `- ${debtor?.fullName || 'Unknown'}${debtor?.isGhost ? ' (Ghost)' : ''} owes ${creditor?.fullName || 'Unknown'}: ₹${balance.amount.toFixed(2)}`;
    });
    return `🧾 *Dutch-it Bill Breakdown*\nGroup: ${summary.group.name}\nTotal: ₹${summary.total.toFixed(2)}\n\n*Owed Balances:*\n${lines.length ? lines.join('\n') : '- Everyone is settled up'}\n\nView full split details: ${shareUrl}`;
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-panel modal-panel--small share-drawer" onClick={(event) => event.stopPropagation()}>
      <h3 className="subsection-title">Share Summary</h3>
      <p className="status-text">Anyone with this link can view the group’s read-only bill summary.</p>
      {error && <p className="status-text status-text--error">{error}</p>}
      {!shareUrl && !error && <p className="status-text">Preparing secure link…</p>}
      {shareUrl && <div className="share-link-preview">{shareUrl}</div>}
      <button className="btn btn--primary" disabled={!shareUrl} onClick={() => copy(shareUrl, 'link')}>
        {copied === 'link' ? 'Link Copied!' : 'Copy Web Link'}
      </button>
      <button className="btn btn--ghost" disabled={!summary} onClick={() => copy(whatsappText(), 'whatsapp')}>
        {copied === 'whatsapp' ? 'Summary Copied!' : 'Copy WhatsApp Summary'}
      </button>
      <button className="btn btn--ghost" onClick={onClose}>Close</button>
    </div>
  </div>;
}

export default ShareSummaryModal;

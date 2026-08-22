import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../api';

// No date library needed for a simple relative-time label — this covers
// the ranges an activity feed actually needs (minutes/hours/days), rolled
// by hand rather than pulling in date-fns/dayjs for one small function.
function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function RecentActivity() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/activity`, { credentials: 'include' });
        const data = await res.json();
        setEvents(data);
      } catch {
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchActivity();
  }, []);

  return (
    <div className="surface-panel activity-panel">
      <h3 className="subsection-title">Recent Activity</h3>

      {isLoading ? (
        <p className="status-text">Loading…</p>
      ) : events.length === 0 ? (
        <p className="status-text">No recent activity.</p>
      ) : (
        <div className="activity-feed">
          {events.map((ev) => (
            <div key={ev.id} className="activity-row">
              <span className={`activity-row__icon ${ev.type === 'settlement' ? 'activity-row__icon--settle' : ''}`}>
                {ev.type === 'settlement' ? '✓' : '₹'}
              </span>
              <div className="activity-row__body">
                <span className="activity-row__text">{ev.text}</span>
                <span className="activity-row__meta">{ev.groupName} · {timeAgo(ev.createdAt)}</span>
              </div>
              <span className="activity-row__amount">₹{ev.amount.toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentActivity;
import { useAuth } from '../context/AuthContext';

function Account() {
  const { user, logout } = useAuth();

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">Account</h2>
      </div>

      <div className="balances-list">
        <div className="balance-row">
          <span className="balance-row__names">Name</span>
          <span>{user.fullName}</span>
        </div>
        <div className="balance-row">
          <span className="balance-row__names">Email</span>
          <span>{user.email}</span>
        </div>
        <div className="balance-row">
          <span className="balance-row__names">Phone</span>
          <span>{user.phoneNumber}</span>
        </div>
      </div>

      <button className="btn btn--primary" style={{ marginTop: 'var(--space-lg)' }} onClick={logout}>
        Log Out
      </button>
    </section>
  );
}

export default Account;
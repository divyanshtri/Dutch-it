import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

function Login({ onSwitchToSignup }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel signature-hero-accent">
        <div className="auth-brand-wrap">
          <Logo />
        </div>
        <h2 className="section-title">Log In</h2>

        <form className="form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="identifier">
              Email or Phone
            </label>
            <input
              id="identifier"
              type="text"
              className="form-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or +91..."
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="status-text status-text--error">{error}</p>}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className="auth-switch">
          New here?{' '}
          <button className="back-link" onClick={onSwitchToSignup}>
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
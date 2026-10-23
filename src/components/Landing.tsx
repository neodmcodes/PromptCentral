import { useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api, ApiError } from '../api';

export function Landing({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      onLogin();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
      setShake((n) => n + 1);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="landing">
      <div className="landing-grid" aria-hidden />
      <div className="landing-inner">
        <p className="landing-eyebrow">PromptCentral</p>
        <h1 className="landing-title">
          Hello, Neo<span className="landing-dot">.</span>
          <span className="landing-cursor" aria-hidden />
        </h1>
        <p className="landing-sub">Your prompts are where you left them.</p>

        <form key={shake} className={`landing-form ${shake ? 'shake' : ''}`} onSubmit={submit}>
          <label className="sr-only" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" aria-label="Enter" disabled={!password || busy}>
            {busy ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}
          </button>
        </form>
        <p className="landing-error" role="alert">
          {error}
        </p>
      </div>
      <footer className="landing-footer">
        <span>{'{{'}</span>save · copy · fill · reuse<span>{'}}'}</span>
      </footer>
    </main>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import AuthCharacterFeminine from '../components/AuthCharacterFeminine';

export default function RegisterPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (name.trim().length > 100) fields.name = 'Must be 100 characters or fewer.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fields.email = 'Must be a valid email address.';
    if (email.trim().length > 254) fields.email = 'Must be 254 characters or fewer.';
    if (password.length < 8) fields.password = 'Must be at least 8 characters.';
    if (password.length > 72) fields.password = 'Must be 72 characters or fewer.';
    if (Object.keys(fields).length > 0) {
      setFieldErrors(fields);
      return;
    }

    setLoading(true);
    try {
      const res = await register(name.trim(), email.trim().toLowerCase(), password);
      setError('');
      setFieldErrors({});
      setAuth(res.user, res.access_token, res.refresh_token);
      navigate('/projects', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setFieldErrors(err.fields);
        else if (err.status === 400 && err.message.toLowerCase().includes('email')) {
          setFieldErrors({ email: 'This email is already registered.' });
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Unable to connect. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">

      {/* ── Left hero panel ── */}
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-hero-text">
            <div className="auth-hero-brand">
              <span className="auth-hero-logo">we present to you,</span>
              <span>TaskFlow</span>
            </div>
            <h2 className="auth-hero-headline">
              Get things done,<br />together.
            </h2>
            <p className="auth-hero-sub">
              Join thousands of teams who ship faster with TaskFlow.
            </p>
          </div>
          <div className="auth-hero-character">
            <AuthCharacterFeminine />
          </div>
        </div>

        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">

          <div className="auth-form-header">
            <h1 className="auth-form-title">Create your account</h1>
            <p className="auth-form-sub">Start organising your work today</p>
          </div>

          {error && (
            <div role="alert" data-variant="error" className="auth-alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <div data-field={fieldErrors.name ? 'error' : undefined}>
              <label htmlFor="name">
                Full name
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Narendra ji Modi ji"
                  required
                  maxLength={100}
                  autoComplete="name"
                  autoFocus
                  aria-invalid={!!fieldErrors.name}
                />
              </label>
              {fieldErrors.name && <p className="error">{fieldErrors.name}</p>}
            </div>

            <div data-field={fieldErrors.email ? 'error' : undefined}>
              <label htmlFor="email">
                Email address
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="notmeinepstienfiles@gmail.com"
                  required
                  maxLength={254}
                  autoComplete="email"
                  aria-invalid={!!fieldErrors.email}
                />
              </label>
              {fieldErrors.email && <p className="error">{fieldErrors.email}</p>}
            </div>

            <div data-field={fieldErrors.password ? 'error' : undefined}>
              <label htmlFor="password">
                Password
                <div className="password-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    aria-invalid={!!fieldErrors.password}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </label>
              {fieldErrors.password && <p className="error">{fieldErrors.password}</p>}
            </div>

            <button
              type="submit"
              className="large auth-submit-btn"
              disabled={loading}
              aria-busy={loading || undefined}
            >
              {loading ? '' : 'Create account'}
            </button>
          </form>

          <div className="auth-divider">
            <span>Already have an account?</span>
          </div>

          <Link to="/login" className="button outline large auth-register-btn">
            Sign in instead
          </Link>
        </div>
      </div>

    </div>
  );
}

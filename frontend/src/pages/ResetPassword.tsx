import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter.js';
import { Shield, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            padding: '0.75rem',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.2))',
            border: '1px solid rgba(99,102,241,0.3)',
            marginBottom: '1rem',
          }}>
            <Shield size={32} color="#6366f1" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.4rem' }}>Set New Password</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enter your new strong password below</p>
        </div>

        {success ? (
          <div className="alert alert-info" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem', padding: '1.5rem' }}>
            <CheckCircle2 size={36} color="var(--accent-cyan)" />
            <div>
              <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '0.2rem' }}>Password Reset Successful!</strong>
              <span>Your active sessions have been revoked. Redirecting to login page...</span>
            </div>
            <Link to="/login" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Sign In Now</Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="password">New Password (Minimum 12 characters)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    placeholder="••••••••••••"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              <PasswordStrengthMeter password={password} />

              <div className="input-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field"
                    placeholder="••••••••••••"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {loading ? 'Updating Password...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

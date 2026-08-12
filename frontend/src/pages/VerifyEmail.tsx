import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refetchUser } = useAuth();

  useEffect(() => {
    if (!token) {
      setError('Verification token is missing from the link.');
      setLoading(false);
      return;
    }

    const confirm = async () => {
      try {
        await api.confirmEmailVerification(token);
        setSuccess(true);
        await refetchUser();
      } catch (err: any) {
        setError(err.message || 'Email verification failed. The link may be expired or invalid.');
      } finally {
        setLoading(false);
      }
    };

    confirm();
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div style={{
          display: 'inline-flex',
          padding: '0.75rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.2))',
          border: '1px solid rgba(99,102,241,0.3)',
          marginBottom: '1.25rem',
        }}>
          <Shield size={32} color="#6366f1" />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>Email Verification</h1>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Verifying your email address...</span>
          </div>
        )}

        {!loading && success && (
          <div>
            <div className="alert alert-info" style={{ flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <CheckCircle2 size={36} color="var(--accent-cyan)" />
              <strong style={{ fontSize: '1.1rem' }}>Email Verified Successfully!</strong>
              <span style={{ fontSize: '0.85rem' }}>Your account is now fully verified.</span>
            </div>
            <Link to="/dashboard" className="btn btn-primary" style={{ width: '100%' }}>Go to Dashboard</Link>
          </div>
        )}

        {!loading && error && (
          <div>
            <div className="alert alert-error" style={{ flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <AlertCircle size={36} color="var(--accent-rose)" />
              <strong style={{ fontSize: '1.1rem' }}>Verification Failed</strong>
              <span style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
            <Link to="/login" className="btn btn-secondary" style={{ width: '100%' }}>Back to Login</Link>
          </div>
        )}
      </div>
    </div>
  );
};

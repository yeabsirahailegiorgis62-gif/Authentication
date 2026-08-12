import React, { useEffect, useState } from 'react';
import { api, SessionInfo } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Laptop, Globe, Clock, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const SecuritySettings: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const { logout } = useAuth();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await api.getSessions();
      setSessions(data.sessions);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSingle = async (sessionId: string, isCurrent: boolean) => {
    try {
      setError(null);
      await api.revokeSession(sessionId);
      if (isCurrent) {
        await logout();
      } else {
        setActionMessage('Session revoked successfully.');
        await fetchSessions();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to revoke session.');
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm('Are you sure you want to log out of all active sessions?')) {
      return;
    }
    try {
      setError(null);
      await api.revokeAllSessions();
      await logout();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke all sessions.');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>Active Sessions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage active server-side sessions across your devices
          </p>
        </div>
        {sessions.length > 1 && (
          <button onClick={handleRevokeAll} className="btn btn-danger">
            <Trash2 size={16} />
            Revoke All Other Sessions
          </button>
        )}
      </div>

      {actionMessage && (
        <div className="alert alert-info">
          <CheckCircle2 size={18} />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading active sessions...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="glass-card"
              style={{
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderLeft: s.isCurrent ? '4px solid var(--primary)' : '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px' }}>
                  <Laptop size={22} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.deviceName || 'Web Browser'}</span>
                    {s.isCurrent && <span className="badge badge-success">Current Session</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Globe size={14} /> {s.ipAddress || 'Unknown IP'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={14} /> Last active: {new Date(s.lastActiveAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleRevokeSingle(s.id, s.isCurrent)}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              >
                {s.isCurrent ? 'Sign Out' : 'Revoke'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

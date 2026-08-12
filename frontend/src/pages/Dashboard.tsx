import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheck, UserCheck, Key, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.3rem' }}>
            Security Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Welcome, {user.name || user.email}</p>
        </div>
        <Link to="/settings/security" className="btn btn-secondary">
          <Lock size={16} />
          Manage Active Sessions
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Status Card 1 */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(16,185,129,0.15)', padding: '0.75rem', borderRadius: '12px', color: 'var(--accent-emerald)' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Session Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>Active & Verified</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Authenticated via secure server-side session token with SHA-256 database hashing.
          </p>
        </div>

        {/* Status Card 2 */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(99,102,241,0.15)', padding: '0.75rem', borderRadius: '12px', color: 'var(--primary)' }}>
              <Key size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Password Hashing</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Argon2id Enforced</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Argon2id algorithm (64MB memory cost, 3 iterations, 4 parallelism) protects credentials.
          </p>
        </div>

        {/* Status Card 3 */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(6,182,212,0.15)', padding: '0.75rem', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
              <UserCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {user.emailVerified ? (
                  <span className="badge badge-success">Verified</span>
                ) : (
                  <span className="badge badge-warning">Unverified</span>
                )}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Account Details Glass Panel */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Account Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.9rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>User ID</span>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>{user.id}</code>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Member Since</span>
            <span>{new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Cookie Security</span>
            <span style={{ color: 'var(--accent-emerald)' }}>HttpOnly, SameSite=Lax, Path=/</span>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Storage Security</span>
            <span style={{ color: 'var(--accent-emerald)' }}>No Tokens Stored in localStorage</span>
          </div>
        </div>
      </div>
    </div>
  );
};

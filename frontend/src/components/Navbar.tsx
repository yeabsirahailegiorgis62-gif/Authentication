import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Shield, LogOut, LayoutDashboard, Lock, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav style={{
      background: 'rgba(11, 17, 31, 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
      padding: '1rem 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}>
            <Shield size={20} color="#fff" />
          </div>
          SecureAuth
        </Link>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link
            to="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: location.pathname === '/dashboard' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </Link>
          <Link
            to="/settings/security"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: location.pathname === '/settings/security' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            <Lock size={16} />
            Security Settings
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name || user.email} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          ) : (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <UserIcon size={18} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.name || user.email.split('@')[0]}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</span>
          </div>
        </div>

        <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </nav>
  );
};

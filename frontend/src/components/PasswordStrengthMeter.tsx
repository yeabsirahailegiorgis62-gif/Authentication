import React from 'react';
import { Check, X, ShieldAlert, ShieldCheck } from 'lucide-react';

interface Props {
  password: string;
}

const COMMON_BREACHED_PASSWORDS = [
  'password12345',
  '123456789012',
  'qwertyuiop12',
  'administrator',
  'welcome12345',
];

export const PasswordStrengthMeter: React.FC<Props> = ({ password }) => {
  if (!password) return null;

  const minLength = password.length >= 12;
  const maxLength = password.length <= 128;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isCommon = COMMON_BREACHED_PASSWORDS.includes(password.toLowerCase());

  let score = 0;
  if (minLength && maxLength) score += 1;
  if (hasUpper) score += 1;
  if (hasLower) score += 1;
  if (hasNumber) score += 1;
  if (hasSpecial) score += 1;
  if (isCommon) score = 0;

  const getBarColor = () => {
    if (isCommon || score <= 2) return '#f43f5e'; // rose
    if (score <= 3) return '#f59e0b'; // amber
    return '#10b981'; // emerald
  };

  const getLabel = () => {
    if (isCommon) return 'Weak (Common breached password)';
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Moderate';
    return 'Strong & Secure';
  };

  return (
    <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {score >= 4 && !isCommon ? <ShieldCheck size={14} color="#10b981" /> : <ShieldAlert size={14} color={getBarColor()} />}
          Password Strength: <strong style={{ color: getBarColor() }}>{getLabel()}</strong>
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{password.length}/128</span>
      </div>

      {/* Strength Bar */}
      <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${(score / 5) * 100}%`,
            background: getBarColor(),
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      </div>

      {/* Rules checklist */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', marginTop: '0.6rem', fontSize: '0.75rem' }}>
        <RuleItem valid={minLength} label="At least 12 characters" />
        <RuleItem valid={hasUpper} label="Uppercase letter" />
        <RuleItem valid={hasLower} label="Lowercase letter" />
        <RuleItem valid={hasNumber} label="Number" />
        <RuleItem valid={hasSpecial} label="Special character" />
        <RuleItem valid={!isCommon} label="Not a common password" />
      </div>
    </div>
  );
};

const RuleItem: React.FC<{ valid: boolean; label: string }> = ({ valid, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: valid ? '#10b981' : '#64748b' }}>
    {valid ? <Check size={12} /> : <X size={12} />}
    <span>{label}</span>
  </div>
);

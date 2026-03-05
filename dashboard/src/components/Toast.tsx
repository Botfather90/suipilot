'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUISCAN_BASE } from '@/lib/constants';

export type ToastData = {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  txDigest?: string;
};

interface ToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.type === 'error' ? 6000 : 4500);
    return () => clearTimeout(t);
  }, [toast.id, toast.type, onDismiss]);

  const colors = {
    success: 'var(--green)',
    error: '#ef4444',
    info: 'var(--yellow)',
  };

  const icons = {
    success: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    info: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: 'var(--surface)', border: `1px solid ${colors[toast.type]}40`,
        borderLeft: `3px solid ${colors[toast.type]}`,
        borderRadius: 12, padding: '12px 16px', minWidth: 280, maxWidth: 380,
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)`,
        cursor: 'pointer',
      }}
      onClick={() => onDismiss(toast.id)}
    >
      <div style={{ color: colors[toast.type], marginTop: 1, flexShrink: 0 }}>
        {icons[toast.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: toast.txDigest ? 4 : 0 }}>
          {toast.message}
        </div>
        {toast.txDigest && (
          <a
            href={`${SUISCAN_BASE}/tx/${toast.txDigest}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 11, color: 'var(--yellow)', textDecoration: 'none', fontFamily: 'monospace' }}
          >
            {toast.txDigest.slice(0, 12)}...{toast.txDigest.slice(-6)} ↗
          </a>
        )}
      </div>
    </motion.div>
  );
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

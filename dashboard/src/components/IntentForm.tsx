'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IntentFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (intent: IntentConfig) => void;
}

export interface IntentConfig {
  type: 'swap' | 'liquidity';
  fromCoin: string;
  toCoin: string;
  amount: string;
  minAmountOut: string;
  guardId: string;
  deadline: number; // epochs
}

const COINS = ['SUI', 'USDC', 'USDT', 'wETH', 'wBTC'];

export default function IntentForm({ open, onClose, onSubmit }: IntentFormProps) {
  const [type, setType] = useState<'swap' | 'liquidity'>('swap');
  const [fromCoin, setFromCoin] = useState('SUI');
  const [toCoin, setToCoin] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [deadline, setDeadline] = useState('3');

  if (!open) return null;

  const minOut = amount && parseFloat(amount) > 0 ? (parseFloat(amount) * (1 - parseFloat(slippage) / 100)).toFixed(4) : '0';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onClose}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          className="neo" style={{ position: 'relative', width: '100%', maxWidth: 440, padding: 28, borderRadius: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>New Intent</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Submit a typed intent for execution</div>
            </div>
            <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18 }}>x</motion.button>
          </div>

          {/* Type Toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {(['swap', 'liquidity'] as const).map(t => (
              <motion.button key={t} onClick={() => setType(t)} whileTap={{ scale: 0.95 }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${type === t ? 'var(--yellow)' : 'var(--border)'}`,
                  background: type === t ? 'rgba(245,197,24,0.08)' : 'transparent',
                  color: type === t ? 'var(--yellow)' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                }}>
                {t === 'swap' ? 'Swap' : 'Add Liquidity'}
              </motion.button>
            ))}
          </div>

          {/* From */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={fromCoin} onChange={e => setFromCoin(e.target.value)}
                className="neo mono" style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', width: 100, cursor: 'pointer' }}>
                {COINS.map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="any"
                className="neo mono" style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }}
                placeholder="0.0" />
            </div>
          </div>

          {/* Swap arrow */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
            <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }} style={{ cursor: 'pointer' }}
              onClick={() => { const tmp = fromCoin; setFromCoin(toCoin); setToCoin(tmp); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
            </motion.div>
          </div>

          {/* To */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>To (estimated)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={toCoin} onChange={e => setToCoin(e.target.value)}
                className="neo mono" style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', width: 100, cursor: 'pointer' }}>
                {COINS.filter(c => c !== fromCoin).map(c => <option key={c}>{c}</option>)}
              </select>
              <div className="neo mono" style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-dim)', fontSize: 14 }}>
                {minOut}
              </div>
            </div>
          </div>

          {/* Slippage */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Slippage Tolerance</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['0.1', '0.5', '1.0', '2.0'].map(s => (
                <motion.button key={s} onClick={() => setSlippage(s)} whileTap={{ scale: 0.94 }}
                  className="mono" style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${slippage === s ? 'var(--yellow)' : 'var(--border)'}`,
                    background: slippage === s ? 'rgba(245,197,24,0.1)' : 'transparent',
                    color: slippage === s ? 'var(--yellow)' : 'var(--text-muted)',
                    fontFamily: 'inherit',
                  }}>{s}%</motion.button>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deadline (epochs)</label>
            <input value={deadline} onChange={e => setDeadline(e.target.value)} type="number"
              className="neo mono" style={{ width: 100, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
          </div>

          {/* Preview */}
          <div className="neo" style={{ padding: 14, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
              <div>intent::create_swap_intent(</div>
              <div style={{ paddingLeft: 16 }}>from: <span style={{ color: 'var(--yellow)' }}>{fromCoin}</span>,</div>
              <div style={{ paddingLeft: 16 }}>to: <span style={{ color: 'var(--yellow)' }}>{toCoin}</span>,</div>
              <div style={{ paddingLeft: 16 }}>amount: <span style={{ color: 'var(--yellow)' }}>{amount || '0'}</span>,</div>
              <div style={{ paddingLeft: 16 }}>min_out: <span style={{ color: 'var(--yellow)' }}>{minOut}</span>,</div>
              <div style={{ paddingLeft: 16 }}>deadline: <span style={{ color: 'var(--yellow)' }}>current_epoch + {deadline}</span>,</div>
              <div>)</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <motion.button onClick={onClose} whileTap={{ scale: 0.95 }}
              className="btn-neo" style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}>
              Cancel
            </motion.button>
            <motion.button
              onClick={() => {
                onSubmit({ type, fromCoin, toCoin, amount, minAmountOut: minOut, guardId: '', deadline: parseInt(deadline) });
                onClose();
              }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ boxShadow: '0 0 20px rgba(245,197,24,0.2)' }}
              className="btn-neo btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              Sign & Submit
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

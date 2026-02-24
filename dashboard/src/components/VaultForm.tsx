'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VaultFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (vault: VaultConfig) => void;
}

export interface VaultConfig {
  name: string;
  strategy: string;
  depositCoin: string;
  feeBps: number;
  guardId: string;
}

const STRATEGIES = [
  { id: 'yield', label: 'Yield Optimizer', desc: 'Compound lending yields across Navi, Scallop, Bucket' },
  { id: 'dca', label: 'DCA Strategy', desc: 'Dollar-cost average into target tokens over time' },
  { id: 'rebalance', label: 'Auto-Rebalance', desc: 'Maintain target portfolio weights across coins' },
  { id: 'arb', label: 'Arbitrage', desc: 'Cross-DEX price discrepancy capture (Cetus/Turbos)' },
];

const COINS = [
  { symbol: 'SUI', type: '0x2::sui::SUI' },
  { symbol: 'USDC', type: '0x...::coin::USDC' },
  { symbol: 'USDT', type: '0x...::coin::USDT' },
  { symbol: 'wETH', type: '0x...::coin::WETH' },
];

export default function VaultForm({ open, onClose, onSubmit }: VaultFormProps) {
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState('yield');
  const [depositCoin, setDepositCoin] = useState('SUI');
  const [feeBps, setFeeBps] = useState('100');

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="modal-container"
        onClick={onClose}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          className="neo modal-content" style={{ position: 'relative', width: '100%', maxWidth: 480, padding: 28, borderRadius: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Create Vault</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Deploy an AI-managed vault strategy</div>
            </div>
            <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18 }}>x</motion.button>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vault Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="neo" style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              placeholder="e.g. SUI Yield Compounder" />
          </div>

          {/* Strategy Selection */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Strategy</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STRATEGIES.map(s => (
                <motion.button key={s.id} onClick={() => setStrategy(s.id)} whileTap={{ scale: 0.98 }}
                  className="neo interactive" style={{
                    padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${strategy === s.id ? 'var(--yellow)' : 'var(--border)'}`,
                    borderRadius: 10, background: strategy === s.id ? 'rgba(245,197,24,0.06)' : 'transparent',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: strategy === s.id ? 'var(--yellow)' : 'var(--text)' }}>{s.label}</div>
                    {strategy === s.id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{s.desc}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Deposit Coin + Fee */}
          <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deposit Token</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {COINS.map(c => (
                  <motion.button key={c.symbol} onClick={() => setDepositCoin(c.symbol)} whileTap={{ scale: 0.94 }}
                    className="mono" style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${depositCoin === c.symbol ? 'var(--yellow)' : 'var(--border)'}`,
                      background: depositCoin === c.symbol ? 'rgba(245,197,24,0.1)' : 'transparent',
                      color: depositCoin === c.symbol ? 'var(--yellow)' : 'var(--text-muted)',
                      fontFamily: 'inherit',
                    }}>{c.symbol}</motion.button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Performance Fee</label>
              <div style={{ position: 'relative' }}>
                <input value={feeBps} onChange={e => setFeeBps(e.target.value)} type="number"
                  className="neo mono" style={{ width: '100%', padding: '10px 40px 10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
                <span className="mono" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-dim)' }}>bps</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{(parseInt(feeBps) / 100).toFixed(1)}% fee on profits</div>
            </div>
          </div>

          {/* Preview */}
          <div className="neo" style={{ padding: 14, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Preview</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
              <div>vault::create_vault&lt;<span style={{ color: 'var(--yellow)' }}>{COINS.find(c => c.symbol === depositCoin)?.type || 'SUI'}</span>&gt;(</div>
              <div style={{ paddingLeft: 16 }}>strategy: <span style={{ color: 'var(--yellow)' }}>{strategy}</span>,</div>
              <div style={{ paddingLeft: 16 }}>fee_bps: <span style={{ color: 'var(--yellow)' }}>{feeBps}</span>,</div>
              <div style={{ paddingLeft: 16 }}>guard_id: <span style={{ color: 'var(--text-dim)' }}>optional</span>,</div>
              <div>)</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <motion.button onClick={onClose} whileTap={{ scale: 0.95 }}
              className="btn-neo" style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}>Cancel</motion.button>
            <motion.button
              onClick={() => {
                onSubmit({ name, strategy, depositCoin, feeBps: parseInt(feeBps), guardId: '' });
                onClose();
              }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ boxShadow: '0 0 20px rgba(245,197,24,0.2)' }}
              className="btn-neo btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              Sign & Deploy
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

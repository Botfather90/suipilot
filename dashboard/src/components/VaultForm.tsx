'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, DEPLOYED, COIN_TYPES, STRATEGY_ALLOCS } from '@/lib/constants';

interface VaultFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (vault: VaultConfig, txDigest: string) => void;
}

export interface VaultConfig {
  name: string;
  strategy: string;
  depositCoin: string;
  coinType: string;
  performanceFeeBps: number;
  managementFeeBps: number;
}

const STRATEGIES = [
  { id: 'yield',     label: 'Yield Optimizer',  desc: 'Compound lending yields — 90% lend, 10% idle' },
  { id: 'dca',       label: 'DCA Strategy',      desc: 'Dollar-cost average — 100% idle, agent executes buys' },
  { id: 'rebalance', label: 'Auto-Rebalance',    desc: 'Maintain target weights — 50% LP, 20% stake, 20% lend' },
  { id: 'arb',       label: 'Arbitrage',         desc: 'Cross-DEX arb — 80% LP deployed across pools' },
];

const COINS = Object.entries(COIN_TYPES).map(([symbol, type]) => ({ symbol, type }));

export default function VaultForm({ open, onClose, onSubmit }: VaultFormProps) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState('yield');
  const [depositCoin, setDepositCoin] = useState('SUI');
  const [performanceFeeBps, setPerformanceFeeBps] = useState('1000'); // 10%
  const [managementFeeBps, setManagementFeeBps] = useState('100');   // 1%
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!account) { setError('Connect your wallet first.'); return; }
    if (!DEPLOYED) {
      setError('Contracts not deployed. Set NEXT_PUBLIC_PACKAGE_ID in .env.local.'); return;
    }

    const perfFee = parseInt(performanceFeeBps);
    const mgmtFee = parseInt(managementFeeBps);

    if (isNaN(perfFee) || perfFee < 0 || perfFee > 3000) {
      setError('Performance fee must be 0–3000 bps (0–30%).'); return;
    }
    if (isNaN(mgmtFee) || mgmtFee < 0 || mgmtFee > 500) {
      setError('Management fee must be 0–500 bps (0–5%).'); return;
    }

    const coinType = COIN_TYPES[depositCoin] ?? COIN_TYPES.SUI;
    const alloc = STRATEGY_ALLOCS[strategy] ?? STRATEGY_ALLOCS.yield;

    try {
      const tx = new Transaction();

      const strat = tx.moveCall({
        target: `${PACKAGE_ID}::vault::new_strategy`,
        arguments: [
          tx.pure.u64(alloc.lp),
          tx.pure.u64(alloc.stake),
          tx.pure.u64(alloc.lend),
          tx.pure.u64(alloc.idle),
          tx.pure.u64(500),  // rebalance_threshold 5%
          tx.pure.u64(8000), // max_single_alloc 80%
        ],
      });

      const adminCap = tx.moveCall({
        target: `${PACKAGE_ID}::vault::create_vault`,
        typeArguments: [coinType],
        arguments: [
          strat,
          tx.pure.u64(perfFee),
          tx.pure.u64(mgmtFee),
        ],
      });

      tx.transferObjects([adminCap], account.address);

      const result = await signAndExecute({ transaction: tx });

      onSubmit({
        name: name || `${depositCoin} ${STRATEGIES.find(s => s.id === strategy)?.label ?? 'Vault'}`,
        strategy,
        depositCoin,
        coinType,
        performanceFeeBps: perfFee,
        managementFeeBps: mgmtFee,
      }, result.digest);

      setName(''); setStrategy('yield'); setDepositCoin('SUI');
      onClose();
    } catch (err: any) {
      setError(err?.message?.slice(0, 120) ?? 'Transaction failed.');
    }
  };

  if (!open) return null;

  const selectedCoin = COINS.find(c => c.symbol === depositCoin);
  const alloc = STRATEGY_ALLOCS[strategy];

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
          className="neo modal-content"
          style={{ position: 'relative', width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', padding: 28, borderRadius: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Create Vault</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Deploy an AI-managed vault on-chain</div>
            </div>
            <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18 }}>✕</motion.button>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Vault Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="neo"
              style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              placeholder="e.g. SUI Yield Compounder" />
          </div>

          {/* Strategy Selection */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Strategy</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STRATEGIES.map(s => (
                <motion.button key={s.id} onClick={() => setStrategy(s.id)} whileTap={{ scale: 0.98 }}
                  className="neo interactive"
                  style={{
                    padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${strategy === s.id ? 'var(--yellow)' : 'var(--border)'}`,
                    borderRadius: 10, background: strategy === s.id ? 'rgba(245,197,24,0.06)' : 'transparent',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: strategy === s.id ? 'var(--yellow)' : 'var(--text)' }}>{s.label}</div>
                    {strategy === s.id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{s.desc}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Deposit Coin */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Deposit Token</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {COINS.map(c => (
                <motion.button key={c.symbol} onClick={() => setDepositCoin(c.symbol)} whileTap={{ scale: 0.94 }}
                  className="mono"
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${depositCoin === c.symbol ? 'var(--yellow)' : 'var(--border)'}`,
                    background: depositCoin === c.symbol ? 'rgba(245,197,24,0.1)' : 'transparent',
                    color: depositCoin === c.symbol ? 'var(--yellow)' : 'var(--text-muted)', fontFamily: 'inherit',
                  }}>{c.symbol}</motion.button>
              ))}
            </div>
          </div>

          {/* Fees */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Performance Fee</label>
              <div style={{ position: 'relative' }}>
                <input value={performanceFeeBps} onChange={e => setPerformanceFeeBps(e.target.value)} type="number"
                  className="neo mono"
                  style={{ width: '100%', padding: '10px 40px 10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>bps</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
                {((parseInt(performanceFeeBps) || 0) / 100).toFixed(1)}% on profits (max 30%)
              </div>
            </div>
            <div>
              <label style={labelStyle}>Management Fee</label>
              <div style={{ position: 'relative' }}>
                <input value={managementFeeBps} onChange={e => setManagementFeeBps(e.target.value)} type="number"
                  className="neo mono"
                  style={{ width: '100%', padding: '10px 40px 10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>bps</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
                {((parseInt(managementFeeBps) || 0) / 100).toFixed(1)}% annual on AUM (max 5%)
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="neo" style={{ padding: 14, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Preview</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
              <div>vault::create_vault&lt;<span style={{ color: 'var(--yellow)' }}>{depositCoin}</span>&gt;(</div>
              <div style={{ paddingLeft: 16 }}>alloc: <span style={{ color: 'var(--yellow)' }}>lp={alloc?.lp/100}% lend={alloc?.lend/100}% idle={alloc?.idle/100}%</span>,</div>
              <div style={{ paddingLeft: 16 }}>perf_fee: <span style={{ color: 'var(--yellow)' }}>{performanceFeeBps} bps</span>, mgmt_fee: <span style={{ color: 'var(--yellow)' }}>{managementFeeBps} bps</span>,</div>
              <div>)</div>
            </div>
          </div>

          {!DEPLOYED && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 12, fontSize: 12, color: '#ef4444' }}>
              Contracts not deployed. Set NEXT_PUBLIC_PACKAGE_ID in .env.local.
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 12, fontSize: 12, color: '#ef4444' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <motion.button onClick={onClose} whileTap={{ scale: 0.95 }}
              className="btn-neo" style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}>Cancel</motion.button>
            <motion.button
              onClick={handleSubmit}
              disabled={isPending}
              whileTap={{ scale: isPending ? 1 : 0.95 }}
              whileHover={{ boxShadow: '0 0 20px rgba(245,197,24,0.2)' }}
              className="btn-neo btn-primary"
              style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: isPending ? 0.6 : 1, cursor: isPending ? 'wait' : 'pointer' }}>
              {isPending ? 'Signing...' : 'Sign & Deploy'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
};

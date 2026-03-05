'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, CONFIG_ID, DEPLOYED, COIN_TYPES } from '@/lib/constants';

interface IntentFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (intent: IntentConfig, txDigest: string) => void;
  guardRailIds?: Array<{ id: string; label: string }>;
}

export interface IntentConfig {
  type: 'swap' | 'liquidity';
  fromCoin: string;
  toCoin: string;
  amount: string;
  minAmountOut: string;
  guardId: string;
  deadline: number;
}

const COINS = Object.keys(COIN_TYPES);

const SLIPPAGE_PRESETS = ['0.1', '0.5', '1.0', '2.0'];

export default function IntentForm({ open, onClose, onSubmit, guardRailIds = [] }: IntentFormProps) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute, isPending, reset } = useSignAndExecuteTransaction();

  const [type, setType] = useState<'swap' | 'liquidity'>('swap');
  const [fromCoin, setFromCoin] = useState('SUI');
  const [toCoin, setToCoin] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [deadline, setDeadline] = useState('10');
  const [guardRailId, setGuardRailId] = useState(guardRailIds[0]?.id ?? '');
  const [preferredProtocol, setPreferredProtocol] = useState('');
  const [error, setError] = useState('');

  const slippageBps = Math.round(parseFloat(slippage) * 100);
  const amountMist = amount ? BigInt(Math.floor(parseFloat(amount) * 1_000_000_000)) : 0n;
  const minOut = amount && parseFloat(amount) > 0
    ? (parseFloat(amount) * (1 - parseFloat(slippage) / 100)).toFixed(6)
    : '0';
  const minOutMist = minOut ? BigInt(Math.floor(parseFloat(minOut) * 1_000_000_000)) : 0n;

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    setError('');
    if (!account) { setError('Connect your wallet first.'); return; }
    if (!guardRailId || !/^0x/.test(guardRailId)) {
      setError('Enter the Guard Rail object ID (0x...).'); return;
    }
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount.'); return; }
    if (fromCoin === toCoin) { setError('From and To coins must be different.'); return; }
    if (!DEPLOYED) {
      setError('Contracts not deployed. Set NEXT_PUBLIC_PACKAGE_ID in .env.local.'); return;
    }

    try {
      const tx = new Transaction();

      // Build Option<String> for preferred protocol
      const protocolOpt = preferredProtocol
        ? tx.moveCall({
            target: '0x1::option::some',
            typeArguments: ['0x1::string::String'],
            arguments: [tx.pure.string(preferredProtocol)],
          })
        : tx.moveCall({
            target: '0x1::option::none',
            typeArguments: ['0x1::string::String'],
            arguments: [],
          });

      const intent = tx.moveCall({
        target: `${PACKAGE_ID}::intent::create_swap_intent`,
        arguments: [
          tx.object(CONFIG_ID),
          tx.object(guardRailId),
          tx.pure.string(COIN_TYPES[fromCoin] ?? fromCoin),
          tx.pure.string(COIN_TYPES[toCoin] ?? toCoin),
          tx.pure.u64(amountMist),
          tx.pure.u64(minOutMist),
          tx.pure.u64(slippageBps),
          protocolOpt,
          tx.pure.u64(parseInt(deadline) || 10),
        ],
      });

      tx.transferObjects([intent], account.address);

      const result = await signAndExecute({ transaction: tx });

      onSubmit({
        type, fromCoin, toCoin,
        amount, minAmountOut: minOut,
        guardId: guardRailId,
        deadline: parseInt(deadline),
      }, result.digest);

      setAmount(''); setGuardRailId(''); setPreferredProtocol('');
      handleClose();
    } catch (err: any) {
      setError(err?.message?.slice(0, 120) ?? 'Transaction failed.');
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="modal-container"
        onClick={handleClose}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          className="neo modal-content"
          style={{ position: 'relative', width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto', padding: 28, borderRadius: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>New Intent</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Submit a typed intent validated against your guard rail</div>
            </div>
            <motion.button onClick={handleClose} whileTap={{ scale: 0.9 }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18 }}>✕</motion.button>
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

          {/* Guard Rail ID */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Guard Rail ID <span style={{ color: '#ef4444' }}>*</span></label>
            {guardRailIds.length > 0 ? (
              <select value={guardRailId} onChange={e => setGuardRailId(e.target.value)}
                className="neo mono"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'monospace' }}>
                <option value="">— select —</option>
                {guardRailIds.map(g => (
                  <option key={g.id} value={g.id}>{g.label || g.id.slice(0, 20) + '...'}</option>
                ))}
              </select>
            ) : (
              <input value={guardRailId} onChange={e => setGuardRailId(e.target.value)}
                className="neo mono"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                placeholder="0x... (Guard Rail object ID)" />
            )}
          </div>

          {/* From */}
          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>From</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={fromCoin} onChange={e => setFromCoin(e.target.value)}
                className="neo mono"
                style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', width: 100, cursor: 'pointer' }}>
                {COINS.map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="any"
                className="neo mono"
                style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }}
                placeholder="0.0" />
            </div>
          </div>

          {/* Swap arrow */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
            <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }} style={{ cursor: 'pointer' }}
              onClick={() => { const tmp = fromCoin; setFromCoin(toCoin); setToCoin(tmp); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
              </svg>
            </motion.div>
          </div>

          {/* To */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>To (min received)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={toCoin} onChange={e => setToCoin(e.target.value)}
                className="neo mono"
                style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', width: 100, cursor: 'pointer' }}>
                {COINS.filter(c => c !== fromCoin).map(c => <option key={c}>{c}</option>)}
              </select>
              <div className="neo mono"
                style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-dim)', fontSize: 14 }}>
                ≥ {minOut}
              </div>
            </div>
          </div>

          {/* Slippage */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Slippage Tolerance</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {SLIPPAGE_PRESETS.map(s => (
                <motion.button key={s} onClick={() => setSlippage(s)} whileTap={{ scale: 0.94 }}
                  className="mono"
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${slippage === s ? 'var(--yellow)' : 'var(--border)'}`,
                    background: slippage === s ? 'rgba(245,197,24,0.1)' : 'transparent',
                    color: slippage === s ? 'var(--yellow)' : 'var(--text-muted)', fontFamily: 'inherit',
                  }}>{s}%</motion.button>
              ))}
            </div>
          </div>

          {/* Preferred Protocol (optional) */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Preferred Protocol <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
            <input value={preferredProtocol} onChange={e => setPreferredProtocol(e.target.value)}
              className="neo"
              style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              placeholder="cetus, turbos, deepbook..." />
          </div>

          {/* Deadline */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>TTL (epochs)</label>
            <input value={deadline} onChange={e => setDeadline(e.target.value)} type="number"
              className="neo mono"
              style={{ width: 100, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>≈ {Math.round(parseInt(deadline || '10') * 24)}h</span>
          </div>

          {/* Preview */}
          <div className="neo" style={{ padding: 14, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 14 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
              <div>intent::create_swap_intent(</div>
              <div style={{ paddingLeft: 16 }}>guard_rail: <span style={{ color: 'var(--yellow)' }}>{guardRailId ? guardRailId.slice(0, 14) + '...' : '(required)'}</span>,</div>
              <div style={{ paddingLeft: 16 }}>from: <span style={{ color: 'var(--yellow)' }}>{fromCoin}</span>, to: <span style={{ color: 'var(--yellow)' }}>{toCoin}</span>,</div>
              <div style={{ paddingLeft: 16 }}>amount: <span style={{ color: 'var(--yellow)' }}>{amount || '0'} {fromCoin}</span>,</div>
              <div style={{ paddingLeft: 16 }}>min_out: <span style={{ color: 'var(--yellow)' }}>{minOut}</span>, slippage: <span style={{ color: 'var(--yellow)' }}>{slippageBps} bps</span>,</div>
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
            <motion.button onClick={handleClose} whileTap={{ scale: 0.95 }}
              className="btn-neo" style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}>
              Cancel
            </motion.button>
            <motion.button
              onClick={handleSubmit}
              disabled={isPending}
              whileTap={{ scale: isPending ? 1 : 0.95 }}
              whileHover={{ boxShadow: '0 0 20px rgba(245,197,24,0.2)' }}
              className="btn-neo btn-primary"
              style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: isPending ? 0.6 : 1, cursor: isPending ? 'wait' : 'pointer' }}>
              {isPending ? 'Signing...' : 'Sign & Submit'}
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

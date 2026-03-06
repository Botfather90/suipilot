'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
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

type GuardFields = {
  maxSingleTrade: bigint;
  maxSlippageBps: number;
  allowedProtocols: string[];
  epochSpendingLimit: bigint;
  epochSpent: bigint;
  allowedCoinTypes: string[];
};

const COINS = Object.keys(COIN_TYPES);
const SLIPPAGE_PRESETS = ['0.1', '0.5', '1.0', '2.0'];
const KNOWN_PROTOCOLS = ['cetus', 'turbos', 'deepbook'];

function formatSui(mist: bigint) {
  return (Number(mist) / 1_000_000_000).toFixed(4);
}

export default function IntentForm({ open, onClose, onSubmit, guardRailIds = [] }: IntentFormProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
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

  const [guardFields, setGuardFields] = useState<GuardFields | null>(null);
  const [guardFetching, setGuardFetching] = useState(false);

  const slippageBps = Math.round(parseFloat(slippage) * 100);
  const amountMist = amount ? BigInt(Math.floor(parseFloat(amount) * 1_000_000_000)) : 0n;
  const minOut = amount && parseFloat(amount) > 0
    ? (parseFloat(amount) * (1 - parseFloat(slippage) / 100)).toFixed(6)
    : '0';
  const minOutMist = minOut ? BigInt(Math.floor(parseFloat(minOut) * 1_000_000_000)) : 0n;

  // Fetch guard fields whenever a valid guard ID is selected
  useEffect(() => {
    if (!guardRailId || !/^0x[0-9a-fA-F]{10,}$/.test(guardRailId)) {
      setGuardFields(null);
      return;
    }
    setGuardFetching(true);
    setGuardFields(null);
    client.getObject({ id: guardRailId, options: { showContent: true } })
      .then(obj => {
        const fields = (obj.data?.content as any)?.fields;
        if (!fields) return;
        setGuardFields({
          maxSingleTrade: BigInt(fields.max_single_trade ?? 0),
          maxSlippageBps: Number(fields.max_slippage_bps ?? 0),
          allowedProtocols: (fields.allowed_protocols ?? []) as string[],
          epochSpendingLimit: BigInt(fields.epoch_spending_limit ?? 0),
          epochSpent: BigInt(fields.epoch_spent ?? 0),
          allowedCoinTypes: (fields.allowed_coin_types ?? []) as string[],
        });
      })
      .catch(() => {})
      .finally(() => setGuardFetching(false));
  }, [guardRailId, client]);

  // Reset protocol when guard changes
  useEffect(() => {
    setPreferredProtocol('');
  }, [guardRailId]);

  const handleClose = () => {
    reset();
    setAmount('');
    setSlippage('0.5');
    setDeadline('10');
    setGuardRailId('');
    setPreferredProtocol('');
    setError('');
    setGuardFields(null);
    onClose();
  };

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

    // Client-side guard rail validation
    if (guardFields) {
      if (guardFields.allowedProtocols.length === 0) {
        setError('This guard has no protocols whitelisted — the contract will reject all intents. Create a new guard rail with at least one protocol selected.');
        return;
      }
      if (!preferredProtocol) {
        setError(`Select a protocol — your guard requires one of: ${guardFields.allowedProtocols.join(', ')}`);
        return;
      }
      if (!guardFields.allowedProtocols.includes(preferredProtocol)) {
        setError(`Protocol "${preferredProtocol}" is not in your guard's whitelist. Allowed: ${guardFields.allowedProtocols.join(', ')}`);
        return;
      }
      if (amountMist > guardFields.maxSingleTrade) {
        setError(`Amount exceeds guard's max single trade limit of ${formatSui(guardFields.maxSingleTrade)} SUI.`);
        return;
      }
      if (guardFields.epochSpent + amountMist > guardFields.epochSpendingLimit) {
        const remaining = guardFields.epochSpendingLimit - guardFields.epochSpent;
        setError(`Epoch spending limit reached. Remaining budget this epoch: ${formatSui(remaining > 0n ? remaining : 0n)} SUI.`);
        return;
      }
      if (slippageBps > guardFields.maxSlippageBps) {
        setError(`Slippage ${slippageBps} bps exceeds guard's max of ${guardFields.maxSlippageBps} bps (${(guardFields.maxSlippageBps / 100).toFixed(2)}%).`);
        return;
      }
      if (guardFields.allowedCoinTypes.length > 0) {
        const coinType = COIN_TYPES[fromCoin] ?? fromCoin;
        if (!guardFields.allowedCoinTypes.includes(coinType)) {
          setError(`Coin ${fromCoin} not in guard's allowed coin types.`);
          return;
        }
      }
    } else if (!preferredProtocol) {
      setError('Enter a preferred protocol (e.g. cetus, turbos, deepbook).');
      return;
    }

    try {
      const tx = new Transaction();

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
      setError(err?.message?.slice(0, 160) ?? 'Transaction failed.');
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
            <select value={guardRailId} onChange={e => setGuardRailId(e.target.value)}
              className="neo mono"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--surface)', border: `1px solid ${!guardRailId ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`, borderRadius: 10, color: guardRailId ? 'var(--text)' : 'var(--text-dim)', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'monospace' }}>
              <option value="">— select guard rail —</option>
              {guardRailIds.map(g => (
                <option key={g.id} value={g.id}>{g.label || g.id.slice(0, 20) + '...'}</option>
              ))}
              {guardRailIds.length === 0 && (
                <option value="" disabled>No guard rails — create one first</option>
              )}
            </select>
            {guardFetching && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Fetching guard limits...</div>
            )}
            {guardFields && (
              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.15)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>Max trade: <span style={{ color: 'var(--yellow)', fontFamily: 'monospace' }}>{formatSui(guardFields.maxSingleTrade)} SUI</span></span>
                <span>Max slippage: <span style={{ color: 'var(--yellow)', fontFamily: 'monospace' }}>{guardFields.maxSlippageBps} bps</span></span>
                <span>
                  Epoch budget:{' '}
                  <span style={{ color: guardFields.epochSpent >= guardFields.epochSpendingLimit ? '#ef4444' : 'var(--yellow)', fontFamily: 'monospace' }}>
                    {formatSui(guardFields.epochSpendingLimit - guardFields.epochSpent > 0n ? guardFields.epochSpendingLimit - guardFields.epochSpent : 0n)} / {formatSui(guardFields.epochSpendingLimit)} SUI
                  </span>
                </span>
              </div>
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
              <div style={{ flex: 1, position: 'relative' }}>
                <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="any"
                  className="neo mono"
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: `1px solid ${guardFields && amountMist > guardFields.maxSingleTrade && amountMist > 0n ? 'rgba(239,68,68,0.6)' : 'var(--border)'}`, borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  placeholder="0.0" />
              </div>
            </div>
            {guardFields && amountMist > 0n && amountMist > guardFields.maxSingleTrade && (
              <div style={{ fontSize: 10, color: '#ef4444', marginTop: 3 }}>
                Exceeds max single trade ({formatSui(guardFields.maxSingleTrade)} SUI)
              </div>
            )}
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
            <label style={labelStyle}>
              Slippage Tolerance
              {guardFields && (
                <span style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>
                  (guard max: {guardFields.maxSlippageBps} bps)
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {SLIPPAGE_PRESETS.map(s => {
                const bps = Math.round(parseFloat(s) * 100);
                const overLimit = guardFields ? bps > guardFields.maxSlippageBps : false;
                return (
                  <motion.button key={s} onClick={() => !overLimit && setSlippage(s)} whileTap={{ scale: overLimit ? 1 : 0.94 }}
                    className="mono"
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: overLimit ? 'not-allowed' : 'pointer',
                      border: `1px solid ${slippage === s ? 'var(--yellow)' : overLimit ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                      background: slippage === s ? 'rgba(245,197,24,0.1)' : 'transparent',
                      color: slippage === s ? 'var(--yellow)' : overLimit ? 'rgba(239,68,68,0.5)' : 'var(--text-muted)', fontFamily: 'inherit',
                      opacity: overLimit ? 0.5 : 1,
                    }}>{s}%</motion.button>
                );
              })}
            </div>
          </div>

          {/* Preferred Protocol */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Protocol <span style={{ color: '#ef4444' }}>*</span>
              {guardFields && guardFields.allowedProtocols.length > 0 && (
                <span style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>
                  (must match guard whitelist)
                </span>
              )}
            </label>
            <select value={preferredProtocol} onChange={e => setPreferredProtocol(e.target.value)}
              className="neo"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--surface)', border: `1px solid ${!preferredProtocol ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`, borderRadius: 10, color: preferredProtocol ? 'var(--text)' : 'var(--text-dim)', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <option value="">— select protocol —</option>
              {(guardFields && guardFields.allowedProtocols.length > 0 ? guardFields.allowedProtocols : KNOWN_PROTOCOLS).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {guardFields && guardFields.allowedProtocols.length === 0 && (
              <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>
                This guard has no protocols whitelisted — intents will be rejected. Create a new guard rail with at least one protocol.
              </div>
            )}
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
              <div style={{ paddingLeft: 16 }}>protocol: <span style={{ color: 'var(--yellow)' }}>{preferredProtocol || '(required)'}</span>,</div>
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

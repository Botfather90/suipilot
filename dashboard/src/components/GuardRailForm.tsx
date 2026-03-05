'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, DEPLOYED, COIN_TYPES } from '@/lib/constants';

interface GuardFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (guard: GuardConfig, txDigest: string) => void;
}

export interface GuardConfig {
  maxSlippageBps: number;
  maxSpendPerEpoch: number;
  whitelistedProtocols: string[];
  allowedCoinTypes: string[];
  label: string;
  agentAddress: string;
}

const KNOWN_PROTOCOLS = [
  { id: 'cetus',     name: 'Cetus',     description: 'Concentrated liquidity DEX' },
  { id: 'turbos',    name: 'Turbos',    description: 'AMM DEX' },
  { id: 'aftermath', name: 'Aftermath', description: 'Multi-asset pools' },
  { id: 'navi',      name: 'Navi',      description: 'Lending protocol' },
  { id: 'scallop',   name: 'Scallop',   description: 'Money market' },
  { id: 'deepbook',  name: 'DeepBook',  description: 'Central limit order book' },
];

const COIN_OPTIONS = Object.keys(COIN_TYPES);

export default function GuardRailForm({ open, onClose, onSubmit }: GuardFormProps) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [label, setLabel] = useState('');
  const [agentAddress, setAgentAddress] = useState('');
  const [maxSlippage, setMaxSlippage] = useState('100');       // basis points
  const [maxSingleTrade, setMaxSingleTrade] = useState('10');  // SUI
  const [maxSpend, setMaxSpend] = useState('50');              // SUI per epoch
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [selectedCoins, setSelectedCoins] = useState<string[]>(['SUI']);
  const [error, setError] = useState('');

  const toggleProtocol = (id: string) =>
    setSelectedProtocols(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleCoin = (sym: string) =>
    setSelectedCoins(p => p.includes(sym) ? p.filter(x => x !== sym) : [...p, sym]);

  const handleSubmit = async () => {
    setError('');
    if (!account) { setError('Connect your wallet first.'); return; }
    if (!agentAddress || !/^0x[0-9a-fA-F]{1,64}$/.test(agentAddress)) {
      setError('Enter a valid agent Sui address (0x...).'); return;
    }
    const slippageBps = parseInt(maxSlippage);
    const singleTradeMist = BigInt(Math.floor(parseFloat(maxSingleTrade) * 1_000_000_000));
    const spendMist = BigInt(Math.floor(parseFloat(maxSpend) * 1_000_000_000));

    if (!slippageBps || slippageBps < 1 || slippageBps > 10_000) {
      setError('Slippage must be between 1 and 10000 bps.'); return;
    }
    if (singleTradeMist <= 0n) { setError('Max single trade must be > 0.'); return; }
    if (spendMist <= 0n) { setError('Max spend per epoch must be > 0.'); return; }

    if (!DEPLOYED) {
      setError('Contracts not deployed. Set NEXT_PUBLIC_PACKAGE_ID in .env.local.'); return;
    }

    try {
      const tx = new Transaction();

      const protocols = tx.makeMoveVec({
        type: '0x1::string::String',
        elements: selectedProtocols.map(p => tx.pure.string(p)),
      });

      const coinTypesVec = tx.makeMoveVec({
        type: '0x1::string::String',
        elements: selectedCoins.map(s => tx.pure.string(COIN_TYPES[s] ?? s)),
      });

      const guard = tx.moveCall({
        target: `${PACKAGE_ID}::guard::create_guard_rail`,
        arguments: [
          tx.pure.u64(slippageBps),
          tx.pure.u64(singleTradeMist),
          tx.pure.u64(spendMist),
          protocols,
          coinTypesVec,
          tx.pure.address(agentAddress),
        ],
      });

      tx.transferObjects([guard], account.address);

      const result = await signAndExecute({ transaction: tx });

      onSubmit({
        label: label || `Guard Rail ${new Date().toLocaleDateString()}`,
        maxSlippageBps: slippageBps,
        maxSpendPerEpoch: parseInt(maxSpend),
        whitelistedProtocols: selectedProtocols,
        allowedCoinTypes: selectedCoins,
        agentAddress,
      }, result.digest);

      // Reset form
      setLabel(''); setAgentAddress(''); setSelectedProtocols([]); setSelectedCoins(['SUI']);
      onClose();
    } catch (err: any) {
      setError(err?.message?.slice(0, 120) ?? 'Transaction failed.');
    }
  };

  if (!open) return null;

  const slippagePct = ((parseInt(maxSlippage) || 0) / 100).toFixed(2);

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
          style={{ position: 'relative', width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto', padding: 28, borderRadius: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Create Guard Rail</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Define on-chain constraints for your AI agent</div>
            </div>
            <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18 }}>✕</motion.button>
          </div>

          {/* Label */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Guard Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)}
              className="neo"
              style={inputStyle}
              placeholder="e.g. Conservative DeFi Guard" />
          </div>

          {/* Agent Address */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Agent Address <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={agentAddress} onChange={e => setAgentAddress(e.target.value)}
              className="neo mono"
              style={{ ...inputStyle, fontSize: 12 }}
              placeholder="0x... (the AI agent wallet address)" />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              This address will be authorized to trade within your constraints.
            </div>
          </div>

          {/* Slippage + Trade + Spend */}
          <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Max Slippage</label>
              <div style={{ position: 'relative' }}>
                <input value={maxSlippage} onChange={e => setMaxSlippage(e.target.value)} type="number"
                  className="neo mono" style={{ ...inputStyle, paddingRight: 36 }} />
                <span style={unitStyle}>bps</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>{slippagePct}%</div>
            </div>
            <div>
              <label style={labelStyle}>Max Trade</label>
              <div style={{ position: 'relative' }}>
                <input value={maxSingleTrade} onChange={e => setMaxSingleTrade(e.target.value)} type="number"
                  className="neo mono" style={{ ...inputStyle, paddingRight: 36 }} />
                <span style={unitStyle}>SUI</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>per trade cap</div>
            </div>
            <div>
              <label style={labelStyle}>Spend / Epoch</label>
              <div style={{ position: 'relative' }}>
                <input value={maxSpend} onChange={e => setMaxSpend(e.target.value)} type="number"
                  className="neo mono" style={{ ...inputStyle, paddingRight: 36 }} />
                <span style={unitStyle}>SUI</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>~24h cap</div>
            </div>
          </div>

          {/* Protocol Whitelist */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Protocol Whitelist
              <span style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>
                {selectedProtocols.length === 0 ? '(all allowed)' : `(${selectedProtocols.length} selected)`}
              </span>
            </label>
            <div className="modal-protocol-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {KNOWN_PROTOCOLS.map(p => {
                const sel = selectedProtocols.includes(p.id);
                return (
                  <motion.button key={p.id} onClick={() => toggleProtocol(p.id)} whileTap={{ scale: 0.97 }}
                    className="neo interactive" style={{
                      padding: '9px 12px', textAlign: 'left', cursor: 'pointer',
                      border: `1px solid ${sel ? 'var(--yellow)' : 'var(--border)'}`,
                      borderRadius: 10, background: sel ? 'rgba(245,197,24,0.06)' : 'transparent',
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: sel ? 'var(--yellow)' : 'var(--text)' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{p.description}</div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Coin Types */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Allowed Coins ({selectedCoins.length})</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COIN_OPTIONS.map(sym => {
                const sel = selectedCoins.includes(sym);
                return (
                  <motion.button key={sym} onClick={() => toggleCoin(sym)} whileTap={{ scale: 0.94 }}
                    style={{
                      padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      border: `1px solid ${sel ? 'var(--yellow)' : 'var(--border)'}`,
                      background: sel ? 'rgba(245,197,24,0.1)' : 'transparent',
                      color: sel ? 'var(--yellow)' : 'var(--text-muted)', fontFamily: 'inherit',
                    }}>{sym}</motion.button>
                );
              })}
            </div>
          </div>

          {/* Tx Preview */}
          <div className="neo" style={{ padding: 14, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Preview</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
              <div>guard::create_guard_rail(</div>
              <div style={{ paddingLeft: 16 }}>max_slippage: <span style={{ color: 'var(--yellow)' }}>{maxSlippage} bps</span>,</div>
              <div style={{ paddingLeft: 16 }}>max_single_trade: <span style={{ color: 'var(--yellow)' }}>{maxSingleTrade} SUI</span>,</div>
              <div style={{ paddingLeft: 16 }}>epoch_limit: <span style={{ color: 'var(--yellow)' }}>{maxSpend} SUI</span>,</div>
              <div style={{ paddingLeft: 16 }}>protocols: <span style={{ color: 'var(--yellow)' }}>[{selectedProtocols.join(', ') || 'all'}]</span>,</div>
              <div style={{ paddingLeft: 16 }}>agent: <span style={{ color: 'var(--yellow)' }}>{agentAddress ? agentAddress.slice(0, 10) + '...' : '(not set)'}</span>,</div>
              <div>)</div>
            </div>
          </div>

          {/* Contract status warning */}
          {!DEPLOYED && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14, fontSize: 12, color: '#ef4444' }}>
              Contracts not deployed. Deploy the Move package and set NEXT_PUBLIC_PACKAGE_ID.
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14, fontSize: 12, color: '#ef4444' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <motion.button onClick={onClose} whileTap={{ scale: 0.95 }}
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
              {isPending ? 'Signing...' : 'Sign & Create'}
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
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const unitStyle: React.CSSProperties = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', pointerEvents: 'none',
};

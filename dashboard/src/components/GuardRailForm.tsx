'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GuardFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (guard: GuardConfig) => void;
}

export interface GuardConfig {
  maxSlippageBps: number;
  maxSpendPerEpoch: number;
  whitelistedProtocols: string[];
  allowedCoinTypes: string[];
  label: string;
}

const KNOWN_PROTOCOLS = [
  { name: 'Cetus', address: '0xcetus...', description: 'Concentrated liquidity DEX' },
  { name: 'Turbos', address: '0xturbos...', description: 'AMM DEX' },
  { name: 'Aftermath', address: '0xafter...', description: 'Multi-asset pools' },
  { name: 'Navi', address: '0xnavi...', description: 'Lending protocol' },
  { name: 'Scallop', address: '0xscallop...', description: 'Money market' },
  { name: 'Bucket', address: '0xbucket...', description: 'CDP stablecoin' },
];

const COIN_TYPES = [
  { symbol: 'SUI', type: '0x2::sui::SUI' },
  { symbol: 'USDC', type: '0x...::coin::USDC' },
  { symbol: 'USDT', type: '0x...::coin::USDT' },
  { symbol: 'wETH', type: '0x...::coin::WETH' },
  { symbol: 'wBTC', type: '0x...::coin::WBTC' },
];

export default function GuardRailForm({ open, onClose, onSubmit }: GuardFormProps) {
  const [label, setLabel] = useState('');
  const [maxSlippage, setMaxSlippage] = useState('50'); // basis points
  const [maxSpend, setMaxSpend] = useState('1000'); // SUI per epoch
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [selectedCoins, setSelectedCoins] = useState<string[]>(['0x2::sui::SUI']);

  const toggleProtocol = (addr: string) =>
    setSelectedProtocols(p => p.includes(addr) ? p.filter(x => x !== addr) : [...p, addr]);
  const toggleCoin = (type: string) =>
    setSelectedCoins(p => p.includes(type) ? p.filter(x => x !== type) : [...p, type]);

  const handleSubmit = () => {
    onSubmit({
      label,
      maxSlippageBps: parseInt(maxSlippage) || 50,
      maxSpendPerEpoch: parseInt(maxSpend) || 1000,
      whitelistedProtocols: selectedProtocols,
      allowedCoinTypes: selectedCoins,
    });
    onClose();
  };

  if (!open) return null;

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
          className="neo" style={{ position: 'relative', width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto', padding: 28, borderRadius: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Create Guard Rail</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Define on-chain constraints for your AI agent</div>
            </div>
            <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18 }}>x</motion.button>
          </div>

          {/* Label */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Guard Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)}
              className="neo" style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              placeholder="e.g. Conservative DeFi Guard" />
          </div>

          {/* Slippage + Spend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Max Slippage (bps)</label>
              <div style={{ position: 'relative' }}>
                <input value={maxSlippage} onChange={e => setMaxSlippage(e.target.value)} type="number"
                  className="neo mono" style={{ width: '100%', padding: '10px 40px 10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
                <span className="mono" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-dim)' }}>bps</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{maxSlippage} bps = {(parseInt(maxSlippage) / 100).toFixed(2)}%</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Max Spend / Epoch</label>
              <div style={{ position: 'relative' }}>
                <input value={maxSpend} onChange={e => setMaxSpend(e.target.value)} type="number"
                  className="neo mono" style={{ width: '100%', padding: '10px 40px 10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
                <span className="mono" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-dim)' }}>SUI</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>~24h epoch spending cap</div>
            </div>
          </div>

          {/* Protocol Whitelist */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Protocol Whitelist
              <span style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>
                {selectedProtocols.length === 0 ? '(all allowed)' : `(${selectedProtocols.length} selected)`}
              </span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {KNOWN_PROTOCOLS.map(p => {
                const sel = selectedProtocols.includes(p.address);
                return (
                  <motion.button key={p.address} onClick={() => toggleProtocol(p.address)} whileTap={{ scale: 0.97 }}
                    className="neo interactive" style={{
                      padding: '10px 12px', textAlign: 'left', cursor: 'pointer', border: `1px solid ${sel ? 'var(--yellow)' : 'var(--border)'}`,
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
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Allowed Coin Types ({selectedCoins.length})
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COIN_TYPES.map(c => {
                const sel = selectedCoins.includes(c.type);
                return (
                  <motion.button key={c.type} onClick={() => toggleCoin(c.type)} whileTap={{ scale: 0.94 }}
                    style={{
                      padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      border: `1px solid ${sel ? 'var(--yellow)' : 'var(--border)'}`,
                      background: sel ? 'rgba(245,197,24,0.1)' : 'transparent',
                      color: sel ? 'var(--yellow)' : 'var(--text-muted)',
                      fontFamily: 'inherit',
                    }}>
                    {c.symbol}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="neo" style={{ padding: 16, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Preview</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
              <div>guard::create_guard(</div>
              <div style={{ paddingLeft: 16 }}>max_slippage: <span style={{ color: 'var(--yellow)' }}>{maxSlippage}</span>,</div>
              <div style={{ paddingLeft: 16 }}>max_spend_per_epoch: <span style={{ color: 'var(--yellow)' }}>{maxSpend}000000000</span>,</div>
              <div style={{ paddingLeft: 16 }}>protocols: <span style={{ color: 'var(--yellow)' }}>[{selectedProtocols.length}]</span>,</div>
              <div style={{ paddingLeft: 16 }}>coin_types: <span style={{ color: 'var(--yellow)' }}>[{selectedCoins.length}]</span>,</div>
              <div>)</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <motion.button onClick={onClose} whileTap={{ scale: 0.95 }}
              className="btn-neo" style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}>
              Cancel
            </motion.button>
            <motion.button onClick={handleSubmit} whileTap={{ scale: 0.95 }}
              whileHover={{ boxShadow: '0 0 20px rgba(245,197,24,0.2)' }}
              className="btn-neo btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              Sign & Create
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

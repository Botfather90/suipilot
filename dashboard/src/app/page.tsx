'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useDisconnectWallet, ConnectModal, useSuiClient } from '@mysten/dapp-kit';
import GuardRailForm from '@/components/GuardRailForm';
import IntentForm from '@/components/IntentForm';
import VaultForm from '@/components/VaultForm';

type Tab = 'overview' | 'vaults' | 'intents' | 'guards';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'vaults', label: 'Vaults' },
  { id: 'intents', label: 'Intents' },
  { id: 'guards', label: 'Guard Rails' },
];

// Cursor follower
function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dotRef.current) { dotRef.current.style.left = `${e.clientX - 4}px`; dotRef.current.style.top = `${e.clientY - 4}px`; }
      if (ringRef.current) { ringRef.current.style.left = `${e.clientX - 18}px`; ringRef.current.style.top = `${e.clientY - 18}px`; }
    };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('button, a, .interactive')) setHovering(true);
    };
    const out = () => setHovering(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseover', over);
    window.addEventListener('mouseout', out);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseover', over); window.removeEventListener('mouseout', out); };
  }, []);

  return <>
    <div ref={dotRef} className="cursor-dot" />
    <div ref={ringRef} className={`cursor-ring ${hovering ? 'hover' : ''}`} />
  </>;
}

// Glow-follow card
function GlowCard({ children, className = '', style = {}, delay = 0 }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current || !glowRef.current) return;
    const rect = ref.current.getBoundingClientRect();
    glowRef.current.style.left = `${e.clientX - rect.left}px`;
    glowRef.current.style.top = `${e.clientY - rect.top}px`;
  }, []);

  return (
    <motion.div
      ref={ref}
      className={`neo glow-box interactive ${className}`}
      style={style}
      onMouseMove={handleMove}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div ref={glowRef} className="glow-follow" />
      {children}
    </motion.div>
  );
}

// Format address
function shortAddr(addr: string) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''; }
function formatSui(mist: bigint) { return (Number(mist) / 1_000_000_000).toFixed(4); }

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const [connectOpen, setConnectOpen] = useState(false);
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const client = useSuiClient();

  // On-chain data
  const [balance, setBalance] = useState<bigint>(0n);
  const [ownedObjects, setOwnedObjects] = useState<number>(0);
  const [txHistory, setTxHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGuardForm, setShowGuardForm] = useState(false);
  const [showIntentForm, setShowIntentForm] = useState(false);
  const [createdGuards, setCreatedGuards] = useState<any[]>([]);
  const [createdIntents, setCreatedIntents] = useState<any[]>([]);
  const [showVaultForm, setShowVaultForm] = useState(false);
  const [createdVaults, setCreatedVaults] = useState<any[]>([]);

  // Fetch wallet data
  useEffect(() => {
    if (!account?.address) { setBalance(0n); setOwnedObjects(0); setTxHistory([]); return; }
    setLoading(true);

    Promise.all([
      client.getBalance({ owner: account.address }),
      client.getOwnedObjects({ owner: account.address, limit: 50 }),
      client.queryTransactionBlocks({ filter: { FromAddress: account.address }, limit: 10, options: { showEffects: true, showInput: true } }),
    ]).then(([bal, objs, txs]) => {
      setBalance(BigInt(bal.totalBalance));
      setOwnedObjects(objs.data.length);
      setTxHistory(txs.data.map(tx => ({
        digest: tx.digest,
        status: tx.effects?.status?.status || 'unknown',
        gas: tx.effects?.gasUsed ? BigInt(tx.effects.gasUsed.computationCost) + BigInt(tx.effects.gasUsed.storageCost) : 0n,
        timestamp: tx.timestampMs ? new Date(Number(tx.timestampMs)).toLocaleString() : '',
        kind: tx.transaction?.data?.transaction?.kind || 'Unknown',
      })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [account?.address, client]);

  return (
    <div style={{ minHeight: '100vh', padding: '80px 40px 40px', position: 'relative' }}>
      <Cursor />
      <div className="grid-bg" />

      {/* Pill Navbar */}
      <nav className="pill-nav">
        <motion.div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
          <motion.div
            style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#000' }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >S</motion.div>
        </motion.div>
        {TABS.map(t => (
          <motion.button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
            whileTap={{ scale: 0.92 }}
          >{t.label}</motion.button>
        ))}
        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
        {account ? (
          <motion.button onClick={() => disconnect()} whileTap={{ scale: 0.92 }} style={{ color: 'var(--yellow)', fontWeight: 600 }}>
            {shortAddr(account.address)}
          </motion.button>
        ) : (
          <ConnectModal
            trigger={<motion.button whileTap={{ scale: 0.92 }} className="active" style={{ fontSize: 12 }}>Connect</motion.button>}
            open={connectOpen}
            onOpenChange={setConnectOpen}
          />
        )}
      </nav>

      {/* Beam line */}
      <motion.div className="beam-line" style={{ marginBottom: 32 }} />

      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {!account ? (
              /* Not connected state */
              <motion.div style={{ textAlign: 'center', paddingTop: 80 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                <motion.div
                  style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-3px', marginBottom: 8, background: 'linear-gradient(135deg, var(--yellow), #fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >SuiPilot</motion.div>
                <motion.div style={{ fontSize: 18, color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto 40px', lineHeight: 1.7 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  AI DeFi Execution Protocol. Programmable guard rails. Typed intents. On-chain audit trails. Connect your wallet to begin.
                </motion.div>
                <ConnectModal
                  trigger={
                    <motion.button className="btn-neo btn-primary" style={{ padding: '16px 40px', fontSize: 16, borderRadius: 50 }}
                      whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(245,197,24,0.3)' }}
                      whileTap={{ scale: 0.95 }}
                    >Connect Wallet</motion.button>
                  }
                  open={connectOpen}
                  onOpenChange={setConnectOpen}
                />
                <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 700, margin: '60px auto 0' }}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                  {[
                    { title: 'Guard Rails', desc: 'Define constraints: max slippage, spending limits, protocol whitelists. Enforced at the contract level.' },
                    { title: 'Typed Intents', desc: 'SwapIntent, LiquidityIntent as on-chain objects. Full lifecycle. Atomic execution.' },
                    { title: 'Audit Trail', desc: 'Every action logged on-chain. Owned objects you can verify independently.' },
                  ].map((f, i) => (
                    <GlowCard key={f.title} style={{ padding: 24 }} delay={0.7 + i * 0.1}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--yellow)', marginBottom: 8 }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</div>
                    </GlowCard>
                  ))}
                </motion.div>
              </motion.div>
            ) : (
              /* Connected: real wallet data */
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'WALLET', value: shortAddr(account.address), color: 'var(--yellow)' },
                    { label: 'SUI BALANCE', value: loading ? '...' : `${formatSui(balance)} SUI`, color: 'var(--yellow)' },
                    { label: 'OWNED OBJECTS', value: loading ? '...' : String(ownedObjects), color: 'var(--text)' },
                    { label: 'TRANSACTIONS', value: loading ? '...' : String(txHistory.length), color: 'var(--text)' },
                  ].map((s, i) => (
                    <GlowCard key={s.label} style={{ padding: 22 }} delay={i * 0.08}>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '1px', marginBottom: 10 }}>{s.label}</div>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </GlowCard>
                  ))}
                </div>

                {/* Transaction History */}
                <GlowCard style={{ overflow: 'hidden', marginBottom: 20 }} delay={0.3}>
                  <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>Recent Transactions</span>
                    <span className="badge badge-yellow" style={{ animation: 'pulse 2s infinite' }}>LIVE</span>
                  </div>
                  {txHistory.length === 0 && !loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
                      No transactions found. Deploy SuiPilot contracts to get started.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Digest', 'Kind', 'Status', 'Gas', 'Time'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {txHistory.map((tx, i) => (
                          <motion.tr key={tx.digest} style={{ borderBottom: '1px solid var(--border)' }}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
                            <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--yellow)' }}>
                              <a href={`https://suiscan.xyz/testnet/tx/${tx.digest}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow)', textDecoration: 'none' }}>
                                {tx.digest.slice(0, 10)}...{tx.digest.slice(-6)}
                              </a>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12 }}>{tx.kind}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className={`badge ${tx.status === 'success' ? 'badge-green' : 'badge-red'}`}>{tx.status}</span>
                            </td>
                            <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                              {tx.gas ? formatSui(tx.gas) : '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-dim)' }}>{tx.timestamp}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </GlowCard>

                {/* Protocol Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <GlowCard style={{ padding: 24 }} delay={0.5}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Protocol Status</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: 'Network', value: 'Sui Testnet', status: true },
                        { label: 'Contracts', value: 'Not Deployed', status: false },
                        { label: 'Guard Rails', value: 'Deploy to create', status: false },
                        { label: 'Active Vaults', value: 'Deploy to create', status: false },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="mono" style={{ fontSize: 12 }}>{item.value}</span>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.status ? 'var(--green)' : 'var(--text-dim)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlowCard>

                  <GlowCard style={{ padding: 24 }} delay={0.6}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Quick Actions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <motion.button className="btn-neo btn-primary" style={{ width: '100%', padding: 14, fontSize: 13, borderRadius: 14 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        Deploy Contracts
                      </motion.button>
                      <motion.button className="btn-neo" style={{ width: '100%', padding: 14, fontSize: 13, borderRadius: 14 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setShowGuardForm(true)}>
                        Create Guard Rail
                      </motion.button>
                      <motion.button className="btn-neo" style={{ width: '100%', padding: 14, fontSize: 13, borderRadius: 14 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setShowVaultForm(true)}>
                        Create Vault
                      </motion.button>
                      <motion.button className="btn-neo" style={{ width: '100%', padding: 14, fontSize: 13, borderRadius: 14 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setShowIntentForm(true)}>
                        Submit Intent
                      </motion.button>
                    </div>
                  </GlowCard>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'vaults' && (
          <motion.div key="vaults" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!account ? (
              <motion.div style={{ textAlign: 'center', paddingTop: 100 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Vaults</div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Connect your wallet to view and manage AI-managed vaults.</div>
                <ConnectModal
                  trigger={<motion.button className="btn-neo btn-primary" style={{ padding: '14px 32px', borderRadius: 50 }} whileTap={{ scale: 0.95 }}>Connect Wallet</motion.button>}
                  open={connectOpen} onOpenChange={setConnectOpen}
                />
              </motion.div>
            ) : (
              <div>
                <motion.div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>Vaults</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>Deploy contracts first, then create vaults</div>
                  </div>
                  <motion.button className="btn-neo btn-primary" style={{ borderRadius: 50 }} whileTap={{ scale: 0.95 }} onClick={() => setShowVaultForm(true)}>+ Create Vault</motion.button>
                </motion.div>
                {createdVaults.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {createdVaults.map((v, i) => (
                      <GlowCard key={i} style={{ padding: 22 }} delay={i * 0.05}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{v.name || `Vault #${i + 1}`}</span>
                          <span className="badge badge-green" style={{ fontSize: 10, padding: '2px 8px' }}>LIVE</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>STRATEGY</div><div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{v.strategy}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>DEPOSIT TOKEN</div><div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--yellow)' }}>{v.depositCoin}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>TVL</div><div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>0 {v.depositCoin}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>FEE</div><div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{(v.feeBps / 100).toFixed(1)}%</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <motion.button className="btn-neo" style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit' }} whileTap={{ scale: 0.96 }}>Deposit</motion.button>
                          <motion.button className="btn-neo" style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit' }} whileTap={{ scale: 0.96 }}>Withdraw</motion.button>
                        </div>
                      </GlowCard>
                    ))}
                  </div>
                ) : (
                <GlowCard style={{ padding: 48, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16, filter: 'grayscale(1) opacity(0.3)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Vaults Found</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 13, maxWidth: 400, margin: '0 auto 16px' }}>
                    Create a vault with a strategy, deposit token, and fee structure. Your AI agent executes the strategy within guard rail constraints.
                  </div>
                  <motion.button className="btn-neo btn-primary" style={{ padding: '12px 28px', borderRadius: 50, fontSize: 13 }}
                    whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(245,197,24,0.25)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowVaultForm(true)}>Create Your First Vault</motion.button>
                </GlowCard>
                )}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'intents' && (
          <motion.div key="intents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!account ? (
              <motion.div style={{ textAlign: 'center', paddingTop: 100 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Intents</div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Connect to view swap and liquidity intents.</div>
                <ConnectModal
                  trigger={<motion.button className="btn-neo btn-primary" style={{ padding: '14px 32px', borderRadius: 50 }} whileTap={{ scale: 0.95 }}>Connect Wallet</motion.button>}
                  open={connectOpen} onOpenChange={setConnectOpen}
                />
              </motion.div>
            ) : (
              <div>
                <motion.div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>Intents</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>Swap and liquidity intents validated against guard rails</div>
                  </div>
                  <motion.button className="btn-neo btn-primary" style={{ borderRadius: 50 }} whileTap={{ scale: 0.95 }} onClick={() => setShowIntentForm(true)}>+ New Intent</motion.button>
                </motion.div>
                <GlowCard style={{ padding: 48, textAlign: 'center' }}>
                  <div style={{ marginBottom: 16 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>
                      <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Intents Yet</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 13, maxWidth: 400, margin: '0 auto' }}>
                    Create a guard rail first, then submit swap or liquidity intents. Each intent is validated against your constraints before execution.
                  </div>
                </GlowCard>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'guards' && (
          <motion.div key="guards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!account ? (
              <motion.div style={{ textAlign: 'center', paddingTop: 100 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Guard Rails</div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Connect to manage your AI agent constraints.</div>
                <ConnectModal
                  trigger={<motion.button className="btn-neo btn-primary" style={{ padding: '14px 32px', borderRadius: 50 }} whileTap={{ scale: 0.95 }}>Connect Wallet</motion.button>}
                  open={connectOpen} onOpenChange={setConnectOpen}
                />
              </motion.div>
            ) : (
              <div>
                <motion.div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>Guard Rails</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>Define what your AI agent can and cannot do</div>
                  </div>
                  <motion.button className="btn-neo btn-primary" style={{ borderRadius: 50 }} whileTap={{ scale: 0.95 }} onClick={() => setShowGuardForm(true)}>+ Create Guard Rail</motion.button>
                </motion.div>
                {createdGuards.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {createdGuards.map((g, i) => (
                      <GlowCard key={i} style={{ padding: 20 }} delay={i * 0.05}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{g.label || `Guard #${i + 1}`}</span>
                          <span className="badge badge-yellow" style={{ fontSize: 10 }}>ACTIVE</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>MAX SLIPPAGE</div><div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{g.maxSlippageBps} bps</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>SPEND / EPOCH</div><div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{g.maxSpendPerEpoch} SUI</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>PROTOCOLS</div><div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{g.whitelistedProtocols.length || 'All'}</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {g.allowedCoinTypes.map((c: string, j: number) => (
                            <span key={j} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(245,197,24,0.1)', color: 'var(--yellow)', fontWeight: 600 }}>
                              {c.includes('SUI') ? 'SUI' : c.split('::').pop()}
                            </span>
                          ))}
                        </div>
                      </GlowCard>
                    ))}
                    <motion.button onClick={() => setShowGuardForm(true)} className="btn-neo" style={{ padding: 16, borderRadius: 14, fontSize: 13, width: '100%', textAlign: 'center' }}
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>+ Add Another Guard Rail</motion.button>
                  </div>
                ) : (
                <GlowCard style={{ padding: 48, textAlign: 'center' }}>
                  <div style={{ marginBottom: 16 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Guard Rails</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 13, maxWidth: 440, margin: '0 auto 20px' }}>
                    Guard rails are on-chain constraints that limit what your AI agent can do. Set max slippage, spending limits per epoch, protocol whitelists, and coin type restrictions.
                  </div>
                  <motion.button className="btn-neo btn-primary" style={{ padding: '14px 32px', borderRadius: 50, fontSize: 14 }}
                    whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(245,197,24,0.25)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowGuardForm(true)}>
                    Create Your First Guard Rail
                  </motion.button>
                </GlowCard>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <GuardRailForm
        open={showGuardForm}
        onClose={() => setShowGuardForm(false)}
        onSubmit={(guard) => setCreatedGuards(p => [...p, guard])}
      />
      <IntentForm
        open={showIntentForm}
        onClose={() => setShowIntentForm(false)}
        onSubmit={(intent) => setCreatedIntents(p => [...p, intent])}
      />

      <VaultForm
        open={showVaultForm}
        onClose={() => setShowVaultForm(false)}
        onSubmit={(vault) => setCreatedVaults(p => [...p, vault])}
      />

      {/* Footer */}
      <motion.div style={{ marginTop: 60, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', paddingBottom: 20 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>SuiPilot v0.1.0 // Sui Testnet</div>
        <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
          <a href="https://github.com/Botfather90/suipilot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow)', textDecoration: 'none' }}>GitHub</a>
          <span style={{ color: 'var(--text-dim)' }}>Docs</span>
          <span style={{ color: 'var(--text-dim)' }}>SDK</span>
        </div>
      </motion.div>
    </div>
  );
}

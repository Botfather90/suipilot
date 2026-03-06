'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useDisconnectWallet, ConnectModal, useSuiClient } from '@mysten/dapp-kit';
import GuardRailForm, { type GuardConfig } from '@/components/GuardRailForm';
import IntentForm, { type IntentConfig } from '@/components/IntentForm';
import VaultForm, { type VaultConfig } from '@/components/VaultForm';
import DocsPage from '@/components/DocsPage';
import Toast, { type ToastData } from '@/components/Toast';
import { PACKAGE_ID, CONFIG_ID, DEPLOYED, SUISCAN_BASE, COIN_TYPES } from '@/lib/constants';

type Tab = 'overview' | 'vaults' | 'intents' | 'guards' | 'docs';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'vaults', label: 'Vaults' },
  { id: 'intents', label: 'Intents' },
  { id: 'guards', label: 'Guard Rails' },
  { id: 'docs', label: 'Docs' },
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

function shortAddr(addr: string) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''; }
function formatSui(mist: bigint) { return (Number(mist) / 1_000_000_000).toFixed(4); }

// On-chain guard rail shape returned from chain
type ChainGuardRail = {
  id: string;
  label?: string;
  maxSlippageBps: number;
  maxSpendPerEpoch: number;
  whitelistedProtocols: string[];
  allowedCoinTypes: string[];
  agentAddress: string;
  active: boolean;
};

type ChainVault = {
  id: string;
  name?: string;
  strategy: string;
  depositCoin: string;
  performanceFeeBps: number;
  managementFeeBps: number;
  paused: boolean;
};

type ChainIntent = {
  id: string;
  fromCoin: string;
  toCoin: string;
  amount: string;
  guardId: string;
  status: string;
  txDigest?: string;
};

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const [connectOpen, setConnectOpen] = useState(false);
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const client = useSuiClient();

  // On-chain wallet data
  const [balance, setBalance] = useState<bigint>(0n);
  const [ownedObjects, setOwnedObjects] = useState<number>(0);
  const [txHistory, setTxHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Protocol state
  const [protocolConfig, setProtocolConfig] = useState<any>(null);

  // Modal state
  const [showGuardForm, setShowGuardForm] = useState(false);
  const [showIntentForm, setShowIntentForm] = useState(false);
  const [showVaultForm, setShowVaultForm] = useState(false);

  // Created items (local + from chain)
  const [createdGuards, setCreatedGuards] = useState<ChainGuardRail[]>([]);
  const [createdVaults, setCreatedVaults] = useState<ChainVault[]>([]);
  const [createdIntents, setCreatedIntents] = useState<ChainIntent[]>([]);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((type: ToastData['type'], message: string, txDigest?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message, txDigest }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Fetch wallet data
  useEffect(() => {
    if (!account?.address) { setBalance(0n); setOwnedObjects(0); setTxHistory([]); return; }
    setLoading(true);

    Promise.all([
      client.getBalance({ owner: account.address }),
      client.getOwnedObjects({ owner: account.address, limit: 50 }),
      client.queryTransactionBlocks({
        filter: { FromAddress: account.address },
        limit: 10,
        options: { showEffects: true, showInput: true },
      }),
    ]).then(([bal, objs, txs]) => {
      setBalance(BigInt(bal.totalBalance));
      setOwnedObjects(objs.data.length);
      setTxHistory(txs.data.map(tx => ({
        digest: tx.digest,
        status: tx.effects?.status?.status || 'unknown',
        gas: tx.effects?.gasUsed
          ? BigInt(tx.effects.gasUsed.computationCost) + BigInt(tx.effects.gasUsed.storageCost)
          : 0n,
        timestamp: tx.timestampMs ? new Date(Number(tx.timestampMs)).toLocaleString() : '',
        kind: tx.transaction?.data?.transaction?.kind || 'Unknown',
      })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [account?.address, client]);

  // Fetch all on-chain data: guards, vaults (VaultAdminCap → Vault), intents, config
  const fetchChainData = useCallback(async () => {
    if (!account?.address || !DEPLOYED) return;

    const [guardsRes, capsRes, intentsRes] = await Promise.allSettled([
      client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::guard::GuardRail` },
        options: { showContent: true },
      }),
      client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::vault::VaultAdminCap` },
        options: { showContent: true, showType: true },
      }),
      client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::intent::SwapIntent` },
        options: { showContent: true },
      }),
    ]);

    if (guardsRes.status === 'fulfilled') {
      const guards = guardsRes.value.data.map(obj => {
        const fields = (obj.data?.content as any)?.fields ?? {};
        return {
          id: obj.data?.objectId ?? '',
          maxSlippageBps: Number(fields.max_slippage_bps ?? 0),
          maxSpendPerEpoch: Number(fields.epoch_spending_limit ?? 0) / 1_000_000_000,
          whitelistedProtocols: (fields.allowed_protocols ?? []) as string[],
          allowedCoinTypes: (fields.allowed_coin_types ?? []) as string[],
          agentAddress: String(fields.agent ?? ''),
          active: Boolean(fields.active),
        } satisfies ChainGuardRail;
      });
      setCreatedGuards(guards);
    }

    if (capsRes.status === 'fulfilled' && capsRes.value.data.length > 0) {
      const vaultIds = capsRes.value.data
        .map(obj => (obj.data?.content as any)?.fields?.vault_id as string | undefined)
        .filter(Boolean) as string[];

      const vaultObjs = await Promise.allSettled(
        vaultIds.map(id => client.getObject({ id, options: { showContent: true, showType: true } }))
      );

      const vaults: ChainVault[] = vaultObjs
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r, i) => {
          const fields = (r.value.data?.content as any)?.fields ?? {};
          const strat = fields.strategy ?? {};
          const t = r.value.data?.type ?? '';
          const coinMatch = t.match(/<(.+)>/);
          const coinType = coinMatch?.[1] ?? '';
          // infer strategy name from allocation values
          const lp = Number(strat.target_alloc_lp ?? 0);
          const lend = Number(strat.target_alloc_lend ?? 0);
          const idle = Number(strat.target_alloc_idle ?? 0);
          let stratName = 'custom';
          if (lend === 9000) stratName = 'yield';
          else if (idle === 10000) stratName = 'dca';
          else if (lp === 5000) stratName = 'rebalance';
          else if (lp === 8000) stratName = 'arb';
          // resolve coin symbol
          let sym = coinType.split('::').pop() ?? coinType;
          for (const [s, ct] of Object.entries(COIN_TYPES)) { if (ct === coinType) { sym = s; break; } }
          return {
            id: r.value.data?.objectId ?? '',
            name: `Vault #${i + 1}`,
            strategy: stratName,
            depositCoin: sym,
            performanceFeeBps: Number(fields.performance_fee_bps ?? 0),
            managementFeeBps: Number(fields.management_fee_bps ?? 0),
            paused: Boolean(fields.paused),
          };
        });
      setCreatedVaults(vaults);
    }

    if (intentsRes.status === 'fulfilled') {
      const STATUS_LABELS = ['PENDING', 'EXECUTED', 'FAILED', 'EXPIRED', 'CANCELLED'];
      const intents = intentsRes.value.data.map(obj => {
        const fields = (obj.data?.content as any)?.fields ?? {};
        const fromFull = String(fields.coin_type_in ?? '');
        const toFull = String(fields.coin_type_out ?? '');
        let fromSym = fromFull.split('::').pop() ?? fromFull;
        let toSym = toFull.split('::').pop() ?? toFull;
        for (const [s, ct] of Object.entries(COIN_TYPES)) {
          if (ct === fromFull) fromSym = s;
          if (ct === toFull) toSym = s;
        }
        return {
          id: obj.data?.objectId ?? '',
          fromCoin: fromSym,
          toCoin: toSym,
          amount: String(Number(fields.amount_in ?? 0) / 1_000_000_000),
          guardId: String(fields.guard_rail_id ?? ''),
          status: STATUS_LABELS[Number(fields.status ?? 0)] ?? 'PENDING',
        } satisfies ChainIntent;
      });
      setCreatedIntents(intents);
    }

    if (CONFIG_ID) {
      client.getObject({ id: CONFIG_ID, options: { showContent: true } }).then(obj => {
        const fields = (obj.data?.content as any)?.fields;
        if (fields) setProtocolConfig(fields);
      }).catch(() => {});
    }
  }, [account?.address, client]);

  // Initial fetch + poll every 8 s for real-time updates
  useEffect(() => {
    if (!account?.address || !DEPLOYED) return;
    fetchChainData();
    const intervalId = setInterval(fetchChainData, 8000);
    return () => clearInterval(intervalId);
  }, [fetchChainData, account?.address]);

  // Form submit handlers — optimistic update + deferred chain refetch
  const handleGuardSubmit = (guard: GuardConfig, txDigest: string) => {
    setCreatedGuards(prev => [...prev, {
      id: '',
      label: guard.label,
      maxSlippageBps: guard.maxSlippageBps,
      maxSpendPerEpoch: guard.maxSpendPerEpoch,
      whitelistedProtocols: guard.whitelistedProtocols,
      allowedCoinTypes: guard.allowedCoinTypes,
      agentAddress: guard.agentAddress,
      active: true,
    }]);
    addToast('success', 'Guard Rail created on-chain!', txDigest);
    setTimeout(fetchChainData, 3000);
  };

  const handleVaultSubmit = (vault: VaultConfig, txDigest: string) => {
    setCreatedVaults(prev => [...prev, {
      id: '',
      name: vault.name,
      strategy: vault.strategy,
      depositCoin: vault.depositCoin,
      performanceFeeBps: vault.performanceFeeBps,
      managementFeeBps: vault.managementFeeBps,
      paused: false,
    }]);
    addToast('success', 'Vault deployed on-chain!', txDigest);
    setTimeout(fetchChainData, 3000);
  };

  const handleIntentSubmit = (intent: IntentConfig, txDigest: string) => {
    setCreatedIntents(prev => [...prev, {
      id: '',
      fromCoin: intent.fromCoin,
      toCoin: intent.toCoin,
      amount: intent.amount,
      guardId: intent.guardId,
      status: 'PENDING',
      txDigest,
    }]);
    addToast('success', 'Intent submitted on-chain!', txDigest);
    setTimeout(fetchChainData, 3000);
  };

  // Guard rail IDs for IntentForm dropdown
  const guardRailIdOptions = createdGuards
    .filter(g => g.id)
    .map(g => ({ id: g.id, label: g.label || `Guard ${g.id.slice(0, 8)}...` }));

  return (
    <div className="page-container" style={{ minHeight: '100vh', padding: '80px 40px 40px', position: 'relative' }}>
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
        {TABS.map(t => {
          const count = t.id === 'vaults' ? createdVaults.length
            : t.id === 'intents' ? createdIntents.length
            : t.id === 'guards' ? createdGuards.length
            : 0;
          return (
            <motion.button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
              whileTap={{ scale: 0.92 }}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {t.label}
              {count > 0 && (
                <span style={{ background: 'var(--yellow)', color: '#000', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 800, lineHeight: 1.4 }}>
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
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
              <motion.div style={{ textAlign: 'center', paddingTop: 80 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                <motion.div className="hero-title"
                  style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-3px', marginBottom: 8, background: 'linear-gradient(135deg, var(--yellow), #fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >SuiPilot</motion.div>
                <motion.div className="hero-subtitle" style={{ fontSize: 18, color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto 40px', lineHeight: 1.7 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  AI DeFi Execution Protocol. Programmable guard rails. Typed intents. On-chain audit trails.
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
                <motion.div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 700, margin: '60px auto 0' }}
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
              <div>
                <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'WALLET', value: shortAddr(account.address), color: 'var(--yellow)' },
                    { label: 'SUI BALANCE', value: loading ? '...' : `${formatSui(balance)} SUI`, color: 'var(--yellow)' },
                    { label: 'OWNED OBJECTS', value: loading ? '...' : String(ownedObjects), color: 'var(--text)' },
                    { label: 'TRANSACTIONS', value: loading ? '...' : String(txHistory.length), color: 'var(--text)' },
                  ].map((s, i) => (
                    <GlowCard key={s.label} style={{ padding: 22 }} delay={i * 0.08}>
                      <div className="stat-label" style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '1px', marginBottom: 10 }}>{s.label}</div>
                      <div className="stat-value mono" style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
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
                    <div className="empty-state" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
                      No transactions found. Deploy SuiPilot contracts to get started.
                    </div>
                  ) : (
                    <div className="table-wrap">
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
                                <a href={`${SUISCAN_BASE}/tx/${tx.digest}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow)', textDecoration: 'none' }}>
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
                    </div>
                  )}
                </GlowCard>

                {/* Protocol Info */}
                <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <GlowCard style={{ padding: 24 }} delay={0.5}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Protocol Status</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(DEPLOYED ? [
                        { label: 'Network', value: 'Sui Testnet', status: true },
                        { label: 'Contracts', value: 'Deployed', status: true },
                        { label: 'Protocol Fee', value: protocolConfig ? `${protocolConfig.fee_bps} bps` : '10 bps', status: true },
                        { label: 'Total Intents', value: protocolConfig ? String(protocolConfig.total_intents_executed) : '—', status: !!protocolConfig },
                      ] : [
                        { label: 'Network', value: 'Sui Testnet', status: true },
                        { label: 'Contracts', value: 'Not Deployed', status: false },
                        { label: 'Guard Rails', value: 'Deploy to create', status: false },
                        { label: 'Active Vaults', value: 'Deploy to create', status: false },
                      ]).map(item => (
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
                      <motion.button
                        className="btn-neo btn-primary"
                        style={{ width: '100%', padding: 14, fontSize: 13, borderRadius: 14 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => window.open('https://github.com/Botfather90/suipilot#deploy', '_blank')}
                      >
                        {DEPLOYED ? 'View on SuiScan' : 'Deploy Contracts'}
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
                <motion.div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>Vaults</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
                      {DEPLOYED ? 'AI-managed vaults on Sui Testnet' : 'Deploy contracts first, then create vaults'}
                    </div>
                  </div>
                  <motion.button className="btn-neo btn-primary" style={{ borderRadius: 50 }} whileTap={{ scale: 0.95 }} onClick={() => setShowVaultForm(true)}>+ Create Vault</motion.button>
                </motion.div>
                {createdVaults.length > 0 ? (
                  <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {createdVaults.map((v, i) => (
                      <GlowCard key={v.id || i} style={{ padding: 22 }} delay={i * 0.05}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{v.name || `Vault #${i + 1}`}</span>
                          <span className={`badge ${v.paused ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                            {v.paused ? 'PAUSED' : 'LIVE'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>STRATEGY</div><div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{v.strategy}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>TOKEN</div><div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--yellow)' }}>{v.depositCoin}</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>PERF FEE</div><div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{(v.performanceFeeBps / 100).toFixed(1)}%</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>MGMT FEE</div><div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{(v.managementFeeBps / 100).toFixed(1)}%/yr</div></div>
                        </div>
                        {v.id && (
                          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>
                            ID: {v.id.slice(0, 12)}...{v.id.slice(-6)}
                          </div>
                        )}
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
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
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
                <motion.div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>Intents</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>Swap and liquidity intents validated against guard rails</div>
                  </div>
                  <motion.button className="btn-neo btn-primary" style={{ borderRadius: 50 }} whileTap={{ scale: 0.95 }} onClick={() => setShowIntentForm(true)}>+ New Intent</motion.button>
                </motion.div>
                {createdIntents.length > 0 ? (
                  <GlowCard style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['From', 'To', 'Amount', 'Guard', 'Status', 'Tx'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {createdIntents.map((intent, i) => (
                          <motion.tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                            <td className="mono" style={{ padding: '12px 16px', fontSize: 13, color: 'var(--yellow)' }}>{intent.fromCoin}</td>
                            <td className="mono" style={{ padding: '12px 16px', fontSize: 13 }}>{intent.toCoin}</td>
                            <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{intent.amount}</td>
                            <td className="mono" style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-dim)' }}>
                              {intent.guardId ? intent.guardId.slice(0, 10) + '...' : '—'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className="badge badge-yellow">{intent.status}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 11 }}>
                              {intent.txDigest ? (
                                <a href={`${SUISCAN_BASE}/tx/${intent.txDigest}`} target="_blank" rel="noopener noreferrer"
                                  style={{ color: 'var(--yellow)', textDecoration: 'none', fontFamily: 'monospace' }}>
                                  {intent.txDigest.slice(0, 8)}... ↗
                                </a>
                              ) : '—'}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </GlowCard>
                ) : (
                  <GlowCard style={{ padding: 48, textAlign: 'center' }}>
                    <div style={{ marginBottom: 16 }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                        <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                        <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Intents Yet</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 13, maxWidth: 400, margin: '0 auto 20px' }}>
                      Create a guard rail first, then submit swap or liquidity intents. Each intent is validated against your constraints before execution.
                    </div>
                    <motion.button className="btn-neo btn-primary" style={{ padding: '12px 28px', borderRadius: 50, fontSize: 13 }}
                      whileTap={{ scale: 0.95 }} onClick={() => setShowIntentForm(true)}>Create First Intent</motion.button>
                  </GlowCard>
                )}
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
                <motion.div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}
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
                      <GlowCard key={g.id || i} style={{ padding: 20 }} delay={i * 0.05}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{g.label || `Guard #${i + 1}`}</span>
                          <span className={`badge ${g.active ? 'badge-yellow' : 'badge-red'}`} style={{ fontSize: 10 }}>
                            {g.active ? 'ACTIVE' : 'REVOKED'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>MAX SLIPPAGE</div><div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{g.maxSlippageBps} bps</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>SPEND / EPOCH</div><div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{g.maxSpendPerEpoch} SUI</div></div>
                          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>PROTOCOLS</div><div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{g.whitelistedProtocols.length || 'All'}</div></div>
                        </div>
                        {g.agentAddress && (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: 8 }}>
                            Agent: {g.agentAddress.slice(0, 12)}...{g.agentAddress.slice(-6)}
                          </div>
                        )}
                        {g.id && (
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: 8 }}>
                            ID:{' '}
                            <a href={`${SUISCAN_BASE}/object/${g.id}`} target="_blank" rel="noopener noreferrer"
                              style={{ color: 'var(--yellow)', textDecoration: 'none' }}>
                              {g.id.slice(0, 14)}... ↗
                            </a>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {g.allowedCoinTypes.map((c, j) => (
                            <span key={j} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(245,197,24,0.1)', color: 'var(--yellow)', fontWeight: 600 }}>
                              {c.includes('::') ? c.split('::').pop() : c}
                            </span>
                          ))}
                        </div>
                      </GlowCard>
                    ))}
                    <motion.button onClick={() => setShowGuardForm(true)} className="btn-neo"
                      style={{ padding: 16, borderRadius: 14, fontSize: 13, width: '100%', textAlign: 'center' }}
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>+ Add Another Guard Rail</motion.button>
                  </div>
                ) : (
                  <GlowCard style={{ padding: 48, textAlign: 'center' }}>
                    <div style={{ marginBottom: 16 }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

        {tab === 'docs' && (
          <motion.div key="docs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DocsPage />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <GuardRailForm
        open={showGuardForm}
        onClose={() => setShowGuardForm(false)}
        onSubmit={handleGuardSubmit}
      />
      <IntentForm
        open={showIntentForm}
        onClose={() => setShowIntentForm(false)}
        onSubmit={handleIntentSubmit}
        guardRailIds={guardRailIdOptions}
      />
      <VaultForm
        open={showVaultForm}
        onClose={() => setShowVaultForm(false)}
        onSubmit={handleVaultSubmit}
      />

      {/* Footer */}
      <motion.div className="page-footer" style={{ marginTop: 60, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', paddingBottom: 20 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          SuiPilot v0.1.0 // Sui Testnet {DEPLOYED ? `// ${PACKAGE_ID.slice(0, 10)}...` : '// not deployed'}
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
          <a href="https://github.com/Botfather90/suipilot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow)', textDecoration: 'none' }}>GitHub</a>
          <span style={{ color: 'var(--text-dim)', cursor: 'pointer' }} onClick={() => setTab('docs')}>Docs</span>
        </div>
      </motion.div>

      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

'use client';
import { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie } from 'recharts';

// Mock protocol data
const PROTOCOL_STATS = {
  totalVolume: '$4.2M',
  totalIntents: '12,847',
  activeVaults: 6,
  activeAgents: 23,
  avgSlippage: '0.12%',
  successRate: '98.7%',
};

const VOLUME_DATA = [
  { day: 'Mon', volume: 320000, intents: 1240 },
  { day: 'Tue', volume: 480000, intents: 1890 },
  { day: 'Wed', volume: 410000, intents: 1650 },
  { day: 'Thu', volume: 590000, intents: 2310 },
  { day: 'Fri', volume: 720000, intents: 2780 },
  { day: 'Sat', volume: 380000, intents: 1520 },
  { day: 'Sun', volume: 290000, intents: 1120 },
];

const PROTOCOL_BREAKDOWN = [
  { name: 'Cetus', value: 42, fill: '#6366f1' },
  { name: 'Turbos', value: 28, fill: '#3b82f6' },
  { name: 'DeepBook', value: 18, fill: '#14b8a6' },
  { name: 'Other', value: 12, fill: '#71717a' },
];

const VAULTS = [
  { name: 'SUI-USDC Yield', apy: '12.4%', tvl: '$1.2M', strategy: 'LP + Stake', status: 'active', shares: 4820, depositors: 142 },
  { name: 'USDC Stable', apy: '5.8%', tvl: '$890K', strategy: 'Lending', status: 'active', shares: 3200, depositors: 89 },
  { name: 'SUI Staking', apy: '8.2%', tvl: '$2.1M', strategy: 'Validator', status: 'active', shares: 7600, depositors: 213 },
  { name: 'wETH-SUI LP', apy: '18.7%', tvl: '$450K', strategy: 'Concentrated LP', status: 'active', shares: 1890, depositors: 67 },
];

const RECENT_INTENTS = [
  { id: '0x8f2a...e4c1', type: 'Swap', pair: 'SUI -> USDC', amount: '2,500 SUI', status: 'executed', protocol: 'Cetus', slippage: '0.08%', time: '2m ago' },
  { id: '0x3b7d...a891', type: 'Swap', pair: 'USDC -> wETH', amount: '5,000 USDC', status: 'executed', protocol: 'Turbos', slippage: '0.15%', time: '4m ago' },
  { id: '0xc1e9...7f23', type: 'LP Add', pair: 'SUI-USDC', amount: '1,200 SUI', status: 'pending', protocol: 'DeepBook', slippage: '-', time: '1m ago' },
  { id: '0x5a4c...b2d8', type: 'Swap', pair: 'SUI -> USDT', amount: '800 SUI', status: 'failed', protocol: 'Cetus', slippage: '-', time: '6m ago' },
  { id: '0x9f1b...c3a7', type: 'Swap', pair: 'wBTC -> SUI', amount: '0.05 wBTC', status: 'executed', protocol: 'Turbos', slippage: '0.22%', time: '8m ago' },
];

const GUARD_RAILS = [
  { id: '0xa2b1...4f8e', owner: '0x7c3a...e291', agent: '0xbot1...8a2f', maxSlippage: '1%', epochLimit: '50K SUI', spent: '12.4K', status: 'active' },
  { id: '0xd8c2...1a3b', owner: '0x5e91...b472', agent: '0xbot2...c7e1', maxSlippage: '0.5%', epochLimit: '100K SUI', spent: '78.2K', status: 'active' },
  { id: '0xf4a7...9c2d', owner: '0x3b28...f914', agent: '0xbot3...a9d2', maxSlippage: '2%', epochLimit: '10K SUI', spent: '9.8K', status: 'near-limit' },
];

type Tab = 'overview' | 'vaults' | 'intents' | 'guards';

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'vaults', label: 'Vaults' },
    { id: 'intents', label: 'Intents' },
    { id: 'guards', label: 'Guard Rails' },
  ];

  return (
    <div style={{ minHeight: '100vh', padding: '20px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff' }}>S</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>SuiPilot</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.5px' }}>AI DEFI EXECUTION PROTOCOL</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge badge-green" style={{ animation: 'pulse 2s infinite' }}>TESTNET</span>
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>Connect Wallet</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ display: 'inline-flex', gap: 0, padding: 4, marginBottom: 28 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 20px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? '#fff' : 'var(--text-muted)',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total Volume', value: PROTOCOL_STATS.totalVolume, color: 'var(--accent)' },
              { label: 'Intents Executed', value: PROTOCOL_STATS.totalIntents, color: 'var(--blue)' },
              { label: 'Active Vaults', value: String(PROTOCOL_STATS.activeVaults), color: 'var(--teal)' },
              { label: 'AI Agents', value: String(PROTOCOL_STATS.activeAgents), color: 'var(--green)' },
              { label: 'Avg Slippage', value: PROTOCOL_STATS.avgSlippage, color: 'var(--amber)' },
              { label: 'Success Rate', value: PROTOCOL_STATS.successRate, color: 'var(--green)' },
            ].map(s => (
              <div key={s.label} className="card glow" style={{ padding: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-1px' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="card glow" style={{ padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Volume (7d)</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>Daily execution volume across all protocols</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={VOLUME_DATA}>
                  <defs>
                    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2a', borderRadius: 10, color: '#e4e4e7', fontSize: 12 }} formatter={(v: number) => [`$${(v/1000).toFixed(1)}K`, 'Volume']} />
                  <Area type="monotone" dataKey="volume" stroke="#6366f1" strokeWidth={2} fill="url(#vg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card glow" style={{ padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Protocol Split</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>DEX routing distribution</div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={PROTOCOL_BREAKDOWN} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {PROTOCOL_BREAKDOWN.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2a', borderRadius: 10, color: '#e4e4e7', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {PROTOCOL_BREAKDOWN.map(p => (
                  <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill }} /> {p.name}
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{p.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Intents */}
          <div className="card glow" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Recent Intents</span>
              <button onClick={() => setTab('intents')} className="btn" style={{ padding: '6px 14px', fontSize: 11 }}>View All</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Intent', 'Type', 'Pair', 'Amount', 'Protocol', 'Slippage', 'Status', 'Time'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {RECENT_INTENTS.map(i => {
                  const sc = i.status === 'executed' ? 'badge-green' : i.status === 'pending' ? 'badge-amber' : 'badge-red';
                  return (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--accent-bright)' }}>{i.id}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12 }}>{i.type}</td>
                      <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{i.pair}</td>
                      <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{i.amount}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{i.protocol}</td>
                      <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: i.slippage === '-' ? 'var(--text-dim)' : 'var(--green)' }}>{i.slippage}</td>
                      <td style={{ padding: '12px 16px' }}><span className={`badge ${sc}`}>{i.status}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-dim)' }}>{i.time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'vaults' && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {VAULTS.map(v => (
              <div key={v.name} className="card glow" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{v.strategy}</div>
                  </div>
                  <span className="badge badge-green">{v.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    { l: 'APY', v: v.apy, c: 'var(--green)' },
                    { l: 'TVL', v: v.tvl, c: 'var(--accent-bright)' },
                    { l: 'Shares', v: v.shares.toLocaleString(), c: 'var(--text)' },
                    { l: 'Depositors', v: String(v.depositors), c: 'var(--text)' },
                  ].map(s => (
                    <div key={s.l}>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.l}</div>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: 12 }}>Deposit</button>
                  <button className="btn" style={{ flex: 1, padding: '8px', fontSize: 12 }}>Withdraw</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'intents' && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="card glow" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Intent Volume</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={VOLUME_DATA} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2a', borderRadius: 10, color: '#e4e4e7', fontSize: 12 }} />
                <Bar dataKey="intents" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card glow" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Intent ID', 'Type', 'Pair', 'Amount', 'Protocol', 'Slippage', 'Status', 'Time'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[...RECENT_INTENTS, ...RECENT_INTENTS].map((i, idx) => {
                  const sc = i.status === 'executed' ? 'badge-green' : i.status === 'pending' ? 'badge-amber' : 'badge-red';
                  return (
                    <tr key={`${i.id}-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--accent-bright)' }}>{i.id}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12 }}>{i.type}</td>
                      <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{i.pair}</td>
                      <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{i.amount}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{i.protocol}</td>
                      <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: i.slippage === '-' ? 'var(--text-dim)' : 'var(--green)' }}>{i.slippage}</td>
                      <td style={{ padding: '12px 16px' }}><span className={`badge ${sc}`}>{i.status}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-dim)' }}>{i.time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'guards' && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Guard Rails</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>User-defined constraints on AI agent behavior</div>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12 }}>+ Create Guard Rail</button>
          </div>
          {GUARD_RAILS.map(g => {
            const pct = parseFloat(g.spent.replace('K', '')) / parseFloat(g.epochLimit.replace('K SUI', '')) * 100;
            const barColor = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--green)';
            return (
              <div key={g.id} className="card glow" style={{ padding: 22, marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Guard Rail</div>
                    <div className="mono" style={{ fontSize: 13, color: 'var(--accent-bright)' }}>{g.id}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Max Slippage</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{g.maxSlippage}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Epoch Limit</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{g.epochLimit}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Spent</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.spent} / {g.epochLimit}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#1e1e2a', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: barColor, width: `${Math.min(pct, 100)}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                  <span className={`badge ${g.status === 'active' ? 'badge-green' : 'badge-amber'}`}>{g.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div><span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Owner: </span><span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.owner}</span></div>
                  <div><span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Agent: </span><span className="mono" style={{ fontSize: 11, color: 'var(--accent-bright)' }}>{g.agent}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', paddingBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>SuiPilot v0.1.0 -- Sui Testnet</div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <a href="https://github.com/Botfather90/suipilot" target="_blank" style={{ color: 'var(--accent-bright)', textDecoration: 'none' }}>GitHub</a>
          <span>Docs</span>
          <span>SDK</span>
        </div>
      </div>
    </div>
  );
}

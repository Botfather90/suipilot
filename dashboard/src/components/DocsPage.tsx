'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type DocSection = 'overview' | 'guards' | 'intents' | 'vaults' | 'audit' | 'sdk';

const SECTIONS: { id: DocSection; title: string; icon: string }[] = [
  { id: 'overview', title: 'Protocol Overview', icon: '◈' },
  { id: 'guards', title: 'Guard Rails', icon: '◇' },
  { id: 'intents', title: 'Typed Intents', icon: '◆' },
  { id: 'vaults', title: 'Vaults', icon: '▣' },
  { id: 'audit', title: 'Audit Trail', icon: '▤' },
  { id: 'sdk', title: 'TypeScript SDK', icon: '▥' },
];

const DOCS: Record<DocSection, { title: string; content: { heading: string; body: string; code?: string }[] }> = {
  overview: {
    title: 'Protocol Overview',
    content: [
      {
        heading: 'What is SuiPilot?',
        body: 'SuiPilot is an on-chain protocol for AI agents to execute DeFi operations on Sui with programmable guard rails. It provides typed intents, on-chain constraints, and full audit trails so users can delegate DeFi execution to AI while maintaining control.',
      },
      {
        heading: 'Architecture',
        body: 'The protocol consists of 7 Move modules: core (admin/config), guard (constraints), intent (typed operations), vault (AI-managed portfolios), logger (audit), math (DeFi calculations), and errors (30+ constants). Each module is designed to be composable.',
      },
      {
        heading: 'Core Module (core.move)',
        body: 'Manages protocol configuration, admin capabilities, pause/unpause, fee management, and protocol whitelisting. The ProtocolConfig shared object stores global settings. AdminCap is required for privileged operations.',
        code: `module suipilot::core {
  struct ProtocolConfig has key {
    id: UID,
    paused: bool,
    fee_bps: u64,
    treasury: address,
    whitelisted_protocols: VecSet<address>,
  }

  struct AdminCap has key, store { id: UID }

  public fun pause(config: &mut ProtocolConfig, _: &AdminCap);
  public fun unpause(config: &mut ProtocolConfig, _: &AdminCap);
  public fun set_fee(config: &mut ProtocolConfig, _: &AdminCap, bps: u64);
}`,
      },
      {
        heading: 'Why On-Chain?',
        body: 'Every constraint, intent, and execution log is an on-chain object. This means: (1) Guard rails are enforced at the Move level, not by the agent. (2) Intent lifecycle is transparent and verifiable. (3) Audit logs are owned objects you can inspect independently. No trust assumptions on the AI agent.',
      },
    ],
  },
  guards: {
    title: 'Guard Rails',
    content: [
      {
        heading: 'Overview',
        body: 'Guard rails are on-chain constraints that limit what an AI agent can do on your behalf. They enforce: maximum slippage (in basis points), spending limits per epoch (~24h), protocol whitelists (which DEXs/lending protocols the agent can interact with), and coin type restrictions.',
      },
      {
        heading: 'Creating a Guard Rail',
        body: 'Each guard is an owned object tied to the creator\'s address. The agent must present a valid guard reference when executing any intent. If the intent violates any constraint, the transaction aborts.',
        code: `module suipilot::guard {
  struct Guard has key, store {
    id: UID,
    owner: address,
    max_slippage_bps: u64,
    max_spend_per_epoch: u64,
    current_epoch_spend: u64,
    last_epoch: u64,
    whitelisted_protocols: VecSet<address>,
    allowed_coin_types: VecSet<String>,
  }

  public fun create_guard(
    max_slippage: u64,
    max_spend: u64,
    protocols: vector<address>,
    coins: vector<String>,
    ctx: &mut TxContext,
  ): Guard;

  public fun validate_intent(guard: &mut Guard, ...): bool;
}`,
      },
      {
        heading: 'Epoch-Based Spending Limits',
        body: 'Spending limits reset each Sui epoch (~24 hours). The guard tracks current_epoch_spend and last_epoch. When the epoch changes, the spend counter resets. This prevents an AI agent from draining funds even if it goes rogue.',
      },
      {
        heading: 'Slippage Enforcement',
        body: 'Max slippage is defined in basis points (1 bps = 0.01%). When an intent is executed, the actual output is compared to the expected output. If slippage exceeds the guard\'s limit, the transaction reverts.',
      },
    ],
  },
  intents: {
    title: 'Typed Intents',
    content: [
      {
        heading: 'What are Intents?',
        body: 'Intents are typed on-chain objects that represent a desired DeFi operation. Instead of the AI agent directly calling DEX functions, it creates an intent object that goes through validation and execution lifecycle.',
      },
      {
        heading: 'Intent Types',
        body: 'SuiPilot supports two intent types: SwapIntent (token swap between two coin types) and LiquidityIntent (add/remove liquidity from pools). Each has its own struct with type-safe fields.',
        code: `module suipilot::intent {
  struct SwapIntent has key, store {
    id: UID,
    owner: address,
    from_coin_type: String,
    to_coin_type: String,
    amount: u64,
    min_amount_out: u64,
    deadline_epoch: u64,
    status: u8, // 0=pending, 1=executed, 2=failed, 3=expired, 4=cancelled
    guard_id: ID,
  }

  struct LiquidityIntent has key, store {
    id: UID,
    owner: address,
    pool_id: ID,
    coin_a_type: String,
    coin_b_type: String,
    amount_a: u64,
    amount_b: u64,
    min_lp_out: u64,
    status: u8,
  }
}`,
      },
      {
        heading: 'Lifecycle',
        body: 'Intent lifecycle: Pending → Executed | Failed | Expired | Cancelled. Only the owner can cancel. Only a whitelisted agent with a valid guard can execute. Expired intents (past deadline_epoch) cannot be executed. Each state transition emits an event.',
      },
    ],
  },
  vaults: {
    title: 'AI-Managed Vaults',
    content: [
      {
        heading: 'Overview',
        body: 'Vaults are AI-managed portfolio strategies. Users deposit tokens, receive share tokens, and the AI agent executes the strategy (yield optimization, DCA, rebalancing, arbitrage) within guard rail constraints.',
      },
      {
        heading: 'Share Accounting',
        body: 'Vault uses standard share-based accounting. Depositors receive shares proportional to their deposit relative to total vault value. On withdrawal, shares are burned and the proportional value is returned. Performance and management fees are taken from yield.',
        code: `module suipilot::vault {
  struct Vault<phantom T> has key {
    id: UID,
    total_shares: u64,
    total_value: u64,
    strategy_id: u8,
    guard_id: ID,
    performance_fee_bps: u64,
    management_fee_bps: u64,
    last_harvest_epoch: u64,
    paused: bool,
  }

  struct ShareToken<phantom T> has key, store {
    id: UID,
    vault_id: ID,
    shares: u64,
  }

  public fun deposit<T>(vault: &mut Vault<T>, coin: Coin<T>, ...): ShareToken<T>;
  public fun withdraw<T>(vault: &mut Vault<T>, token: ShareToken<T>, ...): Coin<T>;
  public fun harvest_yield<T>(vault: &mut Vault<T>, ...);
}`,
      },
      {
        heading: 'Strategies',
        body: 'Four built-in strategies: Yield Optimizer (compound lending yields across Navi, Scallop, Bucket), DCA (dollar-cost average into target tokens), Auto-Rebalance (maintain portfolio weights), Arbitrage (cross-DEX price capture). Custom strategies can be added via governance.',
      },
    ],
  },
  audit: {
    title: 'On-Chain Audit Trail',
    content: [
      {
        heading: 'Logger Module',
        body: 'Every agent action is logged on-chain via the logger module. Execution logs are transferred to the user as owned objects. This creates an immutable, user-owned audit trail of all AI agent activity.',
        code: `module suipilot::logger {
  struct ExecutionLog has key, store {
    id: UID,
    agent: address,
    user: address,
    action_type: String,
    intent_id: ID,
    guard_id: ID,
    timestamp: u64,
    success: bool,
    details: String,
  }

  public fun log_execution(...): ExecutionLog;
  // Log is transferred to user — they own their audit trail
}`,
      },
      {
        heading: 'Why Owned Objects?',
        body: 'Logs are owned objects, not shared or wrapped. This means: users can query their own logs without permission, logs can\'t be modified or deleted by anyone (including the protocol admin), and users can build their own analytics on top of their log objects.',
      },
    ],
  },
  sdk: {
    title: 'TypeScript SDK',
    content: [
      {
        heading: 'Installation',
        body: 'The SuiPilot TypeScript SDK provides type-safe builders for all protocol operations.',
        code: `npm install @suipilot/sdk

import { SuiPilotClient, GuardBuilder, IntentBuilder } from '@suipilot/sdk';

const client = new SuiPilotClient({
  network: 'testnet',
  packageId: '0x...',
});`,
      },
      {
        heading: 'Creating a Guard Rail',
        body: 'Use the GuardBuilder to construct guard rail transactions.',
        code: `const guard = new GuardBuilder()
  .setMaxSlippage(50) // 0.5%
  .setMaxSpendPerEpoch(1000_000_000_000) // 1000 SUI
  .addProtocol('0xcetus...')
  .addProtocol('0xturbos...')
  .addCoinType('0x2::sui::SUI')
  .addCoinType('0x...::coin::USDC')
  .build();

const tx = await client.createGuard(guard);`,
      },
      {
        heading: 'Submitting an Intent',
        body: 'Use the IntentBuilder to create typed intents.',
        code: `const intent = IntentBuilder.swap()
  .from('SUI', amount)
  .to('USDC')
  .minOut(expectedOut * 0.995) // 0.5% slippage
  .withGuard(guardId)
  .deadline(currentEpoch + 3)
  .build();

const tx = await client.submitIntent(intent);`,
      },
      {
        heading: 'Vault Operations',
        body: 'Deposit and withdraw from AI-managed vaults.',
        code: `// Deposit
const shares = await client.depositToVault(vaultId, coin, amount);

// Withdraw
const withdrawn = await client.withdrawFromVault(vaultId, shareToken);

// Check vault stats
const stats = await client.getVaultStats(vaultId);
console.log(stats.tvl, stats.apy, stats.totalShares);`,
      },
    ],
  },
};

export default function DocsPage() {
  const [section, setSection] = useState<DocSection>('overview');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }} className="docs-layout">
        {/* Sidebar */}
        <div className="docs-sidebar" style={{ width: 220, flexShrink: 0, position: 'sticky', top: 90 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12, paddingLeft: 12 }}>
            Documentation
          </div>
          {SECTIONS.map(s => (
            <motion.button
              key={s.id}
              onClick={() => setSection(s.id)}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left', padding: '10px 12px',
                borderRadius: 10, fontSize: 13, fontWeight: section === s.id ? 600 : 400,
                background: section === s.id ? 'rgba(245,197,24,0.08)' : 'transparent',
                color: section === s.id ? 'var(--yellow)' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 14, opacity: 0.6 }}>{s.icon}</span>
              {s.title}
            </motion.button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, color: 'var(--text)' }}>
                {DOCS[section].title}
              </div>
              {DOCS[section].content.map((block, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>{block.heading}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-muted)', marginBottom: block.code ? 14 : 0 }}>{block.body}</div>
                  {block.code && (
                    <div className="neo" style={{ padding: 18, borderRadius: 12, overflow: 'auto' }}>
                      <pre className="mono" style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {block.code}
                      </pre>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

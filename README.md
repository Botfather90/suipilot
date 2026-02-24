# SuiPilot

**AI DeFi Execution Protocol on Sui**

SuiPilot is an on-chain protocol that enables AI agents to execute DeFi operations on the Sui blockchain with programmable guard rails, typed intents, and full audit trails.

## Architecture

```
User                    AI Agent                 Sui Network
  |                        |                        |
  |-- Create GuardRail --> |                        |
  |-- Grant AgentCap ----> |                        |
  |                        |-- Create Intent -----> |  (validated against GuardRail)
  |                        |-- Execute Swap ------> |  (DEX interaction via PTB)
  |                        |-- Log Execution -----> |  (audit trail)
  |                        |                        |
  |<-- ExecutionLog -------|                        |
```

### Core Concepts

- **Guard Rails**: User-defined constraints on what an AI agent can do. Max slippage, spending limits per epoch, protocol whitelists, coin type restrictions. The user stays in control.
- **Intents**: Typed on-chain objects representing what the agent wants to do. SwapIntent, LiquidityIntent. Created by the agent, validated against the guard rail, executed atomically.
- **Vaults**: AI-managed token vaults with share accounting, strategy configuration, performance fees, and yield harvesting. Users deposit, agents manage.
- **Execution Logger**: Every action gets an on-chain audit trail. Transferred to the user as owned objects they can verify independently.

## Move Contracts (1,556 lines)

| Module | Lines | Purpose |
|--------|-------|---------|
| `core.move` | 191 | Protocol config, admin, pause/unpause, fee management |
| `guard.move` | 245 | Guard rails, agent capabilities, trade validation |
| `intent.move` | 286 | Swap and liquidity intents with full lifecycle |
| `vault.move` | 328 | AI-managed vaults, deposit/withdraw, harvest, fees |
| `math.move` | 224 | DeFi math: AMM output, slippage, sqrt, share accounting |
| `logger.move` | 130 | On-chain execution audit trail |
| `errors.move` | 152 | Error constants across all modules |

### Guard Rail Validation

Every trade is validated on-chain before execution:

1. Agent authorization check
2. Slippage limit enforcement
3. Single trade size cap
4. Protocol whitelist check
5. Coin type whitelist check
6. Epoch spending limit with automatic reset

If any constraint is violated, the transaction aborts. No exceptions.

### Intent Lifecycle

```
PENDING --> EXECUTED  (successful swap, meets min output)
        --> FAILED    (agent marks as failed)
        --> EXPIRED   (past TTL, anyone can clean up)
        --> CANCELLED (agent or user cancels)
```

## TypeScript SDK

```bash
npm install @suipilot/sdk
```

```typescript
import { SuiPilotClient } from '@suipilot/sdk';

const pilot = new SuiPilotClient({
  network: 'testnet',
  packageId: '0x...',
  configId: '0x...',
});

// User: create guard rail for their AI agent
const guardTx = pilot.guards.createGuardRail({
  maxSlippageBps: 100,              // 1% max slippage
  maxSingleTrade: 10_000_000_000n,  // 10 SUI per trade
  epochSpendingLimit: 50_000_000_000n, // 50 SUI per epoch
  allowedProtocols: ['cetus', 'turbos', 'deepbook'],
  allowedCoinTypes: [],              // empty = allow all coins
  agent: '0xAGENT_ADDRESS',
});

// Agent: create a swap intent (validated on-chain)
const swapTx = pilot.intents.createSwapIntent({
  guardRailId: '0xGUARD_RAIL_ID',
  coinTypeIn: '0x2::sui::SUI',
  coinTypeOut: '0xUSDC_TYPE',
  amountIn: 1_000_000_000n,   // 1 SUI
  minAmountOut: 900_000n,      // 0.9 USDC minimum
  maxSlippageBps: 50,          // 0.5%
  preferredProtocol: 'cetus',
});

// Read on-chain state
const config = await pilot.getProtocolConfig();
const guards = await pilot.getOwnedGuardRails(ownerAddress);
const intents = await pilot.getPendingIntents(agentAddress);
const vault = await pilot.getVault(vaultId, coinType);
```

### SDK Modules

| Module | Class | Purpose |
|--------|-------|---------|
| `client.ts` | `SuiPilotClient` | Main entry, on-chain reads, event subscriptions |
| `intent-builder.ts` | `IntentBuilder` | PTB composition for swap/liquidity intents |
| `guard.ts` | `GuardBuilder` | Guard rail CRUD, agent cap management |
| `vault.ts` | `VaultBuilder` | Vault creation, deposit/withdraw, strategy updates |
| `types.ts` | - | Full type mirrors of all Move structs and events |

## Dashboard

Dark-themed DeFi dashboard at [suipilot.vercel.app](https://suipilot.vercel.app):

- **Overview**: protocol stats, volume charts, DEX routing breakdown, recent intents
- **Vaults**: APY, TVL, strategy details, deposit/withdraw
- **Intents**: full execution log with status, slippage, protocol routing
- **Guard Rails**: user constraints visualization with epoch spending progress

## Project Structure

```
suipilot/
├── move/                    # On-chain Move contracts
│   ├── Move.toml
│   └── sources/
│       ├── core.move        # Protocol config + admin
│       ├── guard.move       # Guard rails + agent caps
│       ├── intent.move      # Typed intents + lifecycle
│       ├── vault.move       # AI-managed vaults
│       ├── math.move        # DeFi math library
│       ├── logger.move      # Execution audit trail
│       └── errors.move      # Error constants
├── sdk/                     # TypeScript SDK (@suipilot/sdk)
│   ├── src/
│   │   ├── client.ts        # Main client + on-chain reads
│   │   ├── intent-builder.ts # Intent transaction builder
│   │   ├── guard.ts         # Guard rail builder
│   │   ├── vault.ts         # Vault builder
│   │   ├── types.ts         # Type definitions
│   │   └── index.ts         # Barrel exports
│   ├── package.json
│   └── tsconfig.json
└── dashboard/               # Next.js frontend
    ├── src/app/
    │   ├── page.tsx          # Dashboard with recharts
    │   ├── layout.tsx
    │   └── globals.css       # Dark DeFi design system
    ├── package.json
    └── next.config.js
```

## Why SuiPilot

The problem: AI agents are getting good at DeFi strategy, but giving them unrestricted access to your wallet is insane.

SuiPilot's answer: programmable constraints at the contract level. The user defines exactly what the agent can and cannot do. The agent operates within those bounds. Everything is logged on-chain. If the agent tries to exceed its authority, the transaction simply fails.

This isn't about making DeFi "easier." It's about making AI-managed DeFi safe enough to actually use.

## Inspired By

- [Uniswap AI Skills](https://blog.uniswap.org/ai-assistants) (Feb 2025)
- [Jose Cerqueira's Move repos](https://github.com/josecanwill) (code patterns)
- Sui's object-centric model (guard rails as owned objects)
- The Sui Foundation's [$50M developer grant program](https://sui.io/grants)

## License

MIT

---

Built by [Digiton Dynamics](https://digiton.ai) with [SuiPilot SDK](./sdk) and [OpenClaw](https://openclaw.ai).

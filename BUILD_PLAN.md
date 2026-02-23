# SuiPilot — Build Plan

## Architecture
AI DeFi Execution Protocol for Sui. On-chain Move contracts + TypeScript SDK.

## Phase Breakdown (7h+ overnight build)

### Phase 1: Foundation (Now → 01:30 UTC) ✅ IN PROGRESS
**Agent 1: Move Package Setup + Core Types**
- Initialize Move project structure (sui move new)
- Define core types: Intent, GuardRail, AgentCap, ExecutionLog
- Permission system based on kraken's multisig patterns
- Error constants, events, version control

**Agent 2: Math Library**
- Port interest-stable math (fixed-point, sqrt, safe math)
- Swap output calculations (constant product, stableswap invariant)
- Slippage validation functions
- Price impact calculations

### Phase 2: DeFi Core (01:30 → 03:30 UTC)
**Agent 3: Intent Router**
- Intent submission (typed on-chain objects)
- Multi-DEX route simulation
- Best price aggregation logic
- PTB composition for atomic execution

**Agent 4: Guard Rails + Permissions**
- User constraint enforcement (max slippage, spending limits, allowed protocols)
- Epoch-based rate limiting
- AdminCap / AgentCap capability pattern
- Emergency pause mechanism

### Phase 3: Vault System (03:30 → 05:30 UTC)
**Agent 5: Vault Contracts**
- Deposit/withdraw with share accounting
- Strategy execution (LP, staking, lending allocation)
- Yield tracking and distribution
- Rebalance logic

**Agent 6: Execution Logger**
- On-chain execution records
- Action history per agent/user
- Performance metrics (PnL tracking)
- Audit trail objects

### Phase 4: SDK + Frontend + Deploy (05:30 → 07:30 UTC)
**Agent 7: TypeScript SDK**
- SuiPilot client class
- Intent builder (type-safe)
- Guard rail configuration
- Vault interaction helpers
- Transaction composition

**Agent 8: Dashboard + Docs + Deploy**
- Next.js dashboard (vault performance, agent activity, guard rail config)
- README + grant proposal draft
- GitHub repo
- Vercel deploy

## File Structure
```
suipilot/
├── move/
│   ├── Move.toml
│   └── sources/
│       ├── suipilot.move          (core module, types, events)
│       ├── intent.move            (intent submission & routing)
│       ├── guard.move             (guard rails & permissions)
│       ├── vault.move             (vault system)
│       ├── math.move              (DeFi math library)
│       ├── router.move            (multi-DEX routing)
│       ├── logger.move            (execution logging)
│       └── errors.move            (error constants)
├── sdk/
│   ├── package.json
│   ├── src/
│   │   ├── client.ts
│   │   ├── intent-builder.ts
│   │   ├── vault.ts
│   │   ├── guard.ts
│   │   └── types.ts
│   └── tsconfig.json
├── dashboard/
│   ├── package.json
│   └── src/app/
│       ├── page.tsx
│       ├── layout.tsx
│       └── api/
└── README.md
```

## Quality Rules
- Every Move module follows Jose's patterns (types → errors → events → init → public funs → internal helpers → tests)
- Real DeFi math, not placeholder calculations
- Guard rails actually enforce constraints at the contract level
- TypeScript SDK is type-safe with proper generics
- No AI slop. No placeholder "TODO" functions. Ship real code.

## Orchestration
- Main session coordinates and reviews
- Sub-agents spawn for parallel work
- Each phase: spawn agents → let them complete → review → integrate → next phase
- All agents use the joseph-move skill for Move patterns

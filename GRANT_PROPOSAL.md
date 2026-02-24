# SuiPilot -- Sui Foundation Grant Proposal

## Project Title
SuiPilot: AI DeFi Execution Protocol

## Team
**Digiton Dynamics OU** (Estonia)
- Brandon da Costa -- CEO, 3 years in AI automation, 8 years in tech
- Woohyuck -- CTO, full-stack + blockchain development
- Sasha -- Head of Growth, ex-Reddit community growth

## Problem

AI agents are increasingly capable of executing DeFi strategies -- analyzing markets, identifying yield opportunities, timing swaps. But the security model for AI-managed DeFi is broken:

1. **All or nothing**: Users either give full wallet access or no access
2. **No constraints**: No way to limit what an agent can do on-chain
3. **No audit trail**: Off-chain execution logs can be fabricated
4. **No standards**: Every AI agent implements its own ad-hoc safety checks

The result: users don't trust AI agents with their assets, even when the agents could generate significant value.

## Solution

SuiPilot is an on-chain protocol that sits between users and AI agents, providing:

### Guard Rails (User-Defined Constraints)
- Max slippage per trade (bps)
- Max single trade size
- Epoch-level spending limits (auto-reset)
- Protocol whitelist (which DEXes the agent can use)
- Coin type whitelist (which tokens the agent can touch)

These constraints are enforced at the Move contract level. If an agent tries to exceed its authority, the transaction aborts. Period.

### Typed Intents
- SwapIntent and LiquidityIntent as on-chain objects
- Full lifecycle: pending, executed, failed, expired, cancelled
- Validated against guard rails at creation time
- Atomic execution via PTB composition

### AI-Managed Vaults
- Users deposit tokens, receive proportional shares
- AI agents manage strategy within vault parameters
- Performance fees taken on yield, not deposits
- Transparent share price accounting

### Execution Logger
- Every action recorded on-chain as owned objects
- Users can independently verify their agent's behavior
- Full audit trail without trusting off-chain infrastructure

## Technical Architecture

### Move Contracts (1,556 lines, complete)
- 7 modules: core, guard, intent, vault, math, logger, errors
- Real DeFi math (AMM output calculations, slippage validation, share accounting)
- Follows Sui best practices (object-centric design, capability pattern)

### TypeScript SDK (complete)
- Type-safe PTB composition
- On-chain reads for all protocol state
- Event subscriptions
- Ready for npm publish

### Dashboard (complete)
- Protocol analytics and monitoring
- Vault management interface
- Intent execution log
- Guard rail configuration

## Differentiation

| Feature | SuiPilot | Existing Solutions |
|---------|----------|-------------------|
| On-chain guard rails | Yes | No (off-chain checks only) |
| Typed intent system | Yes | No (raw transactions) |
| Epoch spending limits | Yes | No |
| Protocol whitelist | Yes | No |
| On-chain audit trail | Yes | Partial (centralized logs) |
| Sui-native (objects, PTBs) | Yes | EVM-ported |

## Milestones

### M1: Testnet Deploy (4 weeks)
- Deploy Move contracts to Sui testnet
- Publish SDK to npm
- Deploy dashboard to production
- Integration tests with Cetus and Turbos

### M2: Agent Framework (4 weeks)
- Reference AI agent implementation
- Natural language intent parsing
- Multi-DEX route optimization
- WebSocket real-time execution

### M3: Mainnet + Ecosystem (4 weeks)
- Security audit (Move Prover + manual review)
- Mainnet deployment
- Documentation and developer guides
- Partnership integrations with Sui DeFi protocols

## Budget

| Item | Cost |
|------|------|
| Smart contract audit | $15,000 |
| Infrastructure (12 months) | $3,000 |
| Development (3 months) | $30,000 |
| Marketing and community | $2,000 |
| **Total** | **$50,000** |

## Existing Progress

This is not a proposal for something we plan to build. The core protocol is already built:

- 1,556 lines of Move contracts (7 modules)
- Complete TypeScript SDK with type-safe PTB composition
- Dashboard with protocol analytics
- GitHub: https://github.com/Botfather90/suipilot

We're requesting funding to take it from prototype to production: audit, mainnet deploy, ecosystem integrations, and reference agent implementation.

## Links

- GitHub: https://github.com/Botfather90/suipilot
- Dashboard: https://suipilot.vercel.app
- Team: https://digiton.ai
- Contact: contact@digiton.ai

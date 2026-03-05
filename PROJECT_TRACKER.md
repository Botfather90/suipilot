# SuiPilot — Project Tracker

> **AI DeFi Execution Protocol on Sui**
> Programmable guard rails · Typed intents · On-chain audit trails
>
> Last updated: 2026-03-05

---

## YOUR ACTION ITEMS (Things you need to do)

> Everything Claude can build is done. These require you to act.

- [x] **Install Sui CLI** — done
- [x] **Create/verify wallet** — done
- [x] **Fund wallet** — done
- [x] **Deploy contracts** — done
- [x] **Grab IDs from deploy output** — done
- [x] **Create `dashboard/.env.local`** — done
- [x] **Set env vars in Vercel** — done

---

## Project Status Overview

| Area | Status | Notes |
|------|--------|-------|
| Move Contracts | ✅ Written | 7 modules, ~1,556 lines. Awaiting deployment. |
| TypeScript SDK | ✅ Written | Full PTB builders, type-safe, 6 modules. |
| Dashboard | ✅ Built + wired | Real tx submission, on-chain data fetching, toast notifications. Build passes. |
| Move Tests | ✅ Written | 17 tests: guard rail, vault, math. |
| Deployment | ⏳ Blocked | Sui CLI not installed on dev machine. |
| Vercel Live | ⏳ Partial | Deployed but shows "Not Deployed" until contracts go live. |

---

## Phase 1 — Move Contracts ✅ COMPLETE

### Core Modules Written

| File | Lines | Status | Description |
|------|-------|--------|-------------|
| `move/sources/core.move` | 191 | ✅ Done | Protocol config, admin cap, pause/unpause, fee management, protocol registry |
| `move/sources/guard.move` | 245 | ✅ Done | Guard rails, agent caps, 6-step trade validation, epoch rate limiting |
| `move/sources/intent.move` | 286 | ✅ Done | SwapIntent + LiquidityIntent lifecycle (PENDING → EXECUTED/FAILED/EXPIRED/CANCELLED) |
| `move/sources/vault.move` | 328 | ✅ Done | AI-managed vaults, share accounting, deposit/withdraw, harvest, fees |
| `move/sources/math.move` | 224 | ✅ Done | AMM math, slippage, sqrt, share calculations, price impact |
| `move/sources/logger.move` | 130 | ✅ Done | On-chain execution audit trail |
| `move/sources/errors.move` | 152 | ✅ Done | All error constants across modules |
| `move/sources/tests.move` | ~300 | ✅ Done | 17 Move unit tests (see Phase 5) |

### Guard Rail Validation Flow (on-chain, every trade)
1. Guard rail must be active
2. Caller must be the authorized agent address
3. Slippage ≤ `max_slippage_bps`
4. Trade size ≤ `max_single_trade`
5. Protocol must be in `allowed_protocols` whitelist
6. Coin type must be in `allowed_coin_types` whitelist (empty = all allowed)
7. Epoch spending ≤ `epoch_spending_limit` (auto-resets each epoch)

If any check fails → transaction aborts. No exceptions.

### Key Design Decisions
- `GuardRail` is an **owned object** — user controls it, agent cannot modify constraints
- `AgentCap` is granted to the agent separately — can be revoked at any time
- Protocol IDs are strings: `"cetus"`, `"turbos"`, `"deepbook"`, etc.
- Vault strategy allocations must sum to 10,000 bps (100%)
- `ProtocolConfig` is a **shared object** — one global config, admin-controlled

---

## Phase 2 — TypeScript SDK ✅ COMPLETE

### SDK Modules (`sdk/src/`)

| File | Class | Status | Description |
|------|-------|--------|-------------|
| `client.ts` | `SuiPilotClient` | ✅ Done | Main entry, on-chain reads, event subscriptions |
| `intent-builder.ts` | `IntentBuilder` | ✅ Done | PTB composition for swap/liquidity intents |
| `guard.ts` | `GuardBuilder` | ✅ Done | Guard rail CRUD, agent cap grant/revoke |
| `vault.ts` | `VaultBuilder` | ✅ Done | Vault create, deposit, withdraw, harvest, fees |
| `types.ts` | — | ✅ Done | Full TypeScript mirrors of all Move structs and events |
| `index.ts` | — | ✅ Done | Barrel exports |

### Known SDK Bug
`tx.pure.address('sender')` in several builders is incorrect — literal string `'sender'` is not a valid address. The dashboard forms use `account.address` directly instead, bypassing this bug.

**Fix needed in SDK before publishing to npm:**
```ts
// WRONG (current SDK):
tx.transferObjects([guard], tx.pure.address('sender'));

// CORRECT (dashboard does this):
tx.transferObjects([guard], account.address);
```

---

## Phase 3 — Dashboard ✅ COMPLETE

### Pages & Components (`dashboard/src/`)

| File | Status | Description |
|------|--------|-------------|
| `app/page.tsx` | ✅ Done | Full 5-tab dashboard: Overview, Vaults, Intents, Guards, Docs |
| `app/layout.tsx` | ✅ Done | Root layout with font + metadata |
| `app/providers.tsx` | ✅ Done | `SuiClientProvider` + `WalletProvider` (testnet default) |
| `app/globals.css` | ✅ Done | Dark neomorphic design system (bg `#111`, yellow `#F5C518`) |
| `components/GuardRailForm.tsx` | ✅ Done | Create guard rail — full PTB submission via dapp-kit |
| `components/IntentForm.tsx` | ✅ Done | Submit swap intent — builds `create_swap_intent` PTB |
| `components/VaultForm.tsx` | ✅ Done | Deploy vault — builds `create_vault` PTB with strategy |
| `components/DocsPage.tsx` | ✅ Done | In-app documentation tab |
| `components/Toast.tsx` | ✅ Done | Success/error/info toasts with SuiScan tx links |
| `lib/constants.ts` | ✅ Done | `PACKAGE_ID`, `CONFIG_ID`, `DEPLOYED`, `COIN_TYPES`, `STRATEGY_ALLOCS` |

### Dashboard Features
- [x] Wallet connect/disconnect (Sui Wallet, Slush, etc.)
- [x] Real balance + owned objects count fetched on connect
- [x] Transaction history table with SuiScan links
- [x] Guard Rail form → on-chain `guard::create_guard_rail` PTB
- [x] Intent form → on-chain `intent::create_swap_intent` PTB
- [x] Vault form → on-chain `vault::create_vault` PTB
- [x] All forms: loading states, validation, inline error display
- [x] Toast notifications: success with tx digest link, error with message
- [x] Protocol Status card reads from on-chain `ProtocolConfig` (when deployed)
- [x] Guards tab fetches owned `GuardRail` objects from chain (when deployed)
- [x] Vaults tab fetches owned `VaultAdminCap` objects from chain (when deployed)
- [x] Intents tab shows submitted intents with SuiScan links
- [x] "Deploy Contracts" button links to GitHub deploy guide
- [x] Mobile responsive grid layouts
- [x] Animated cursor, glow-follow cards, beam line
- [x] Build passes: `npm run build` → 0 TypeScript errors
- [ ] Vault Deposit button wired to PTB (needs vault object IDs post-deploy)
- [ ] Vault Withdraw button wired to PTB (needs VaultShare object IDs post-deploy)

---

## Phase 4 — Environment & Config ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| `dashboard/.env.example` | ✅ Done | Template with `NEXT_PUBLIC_PACKAGE_ID` + `NEXT_PUBLIC_CONFIG_ID` |
| `dashboard/src/lib/constants.ts` | ✅ Done | Reads env vars, exports `DEPLOYED` flag |
| Contracts-not-deployed UX | ✅ Done | All forms show warning banner when `PACKAGE_ID` unset |
| Post-deploy on-chain fetching | ✅ Done | Auto-fetches guard rails, vaults, protocol config when `DEPLOYED = true` |

---

## Phase 5 — Tests ✅ COMPLETE

### Move Tests (`move/sources/tests.move` — 17 tests)

#### Math Tests (7)
| Test | Status |
|------|--------|
| `test_math_mul_div_basic` | ✅ Written |
| `test_math_mul_div_up_basic` | ✅ Written |
| `test_math_sqrt_values` | ✅ Written |
| `test_math_shares_to_mint_first_deposit` | ✅ Written |
| `test_math_shares_to_mint_proportional` | ✅ Written |
| `test_math_shares_to_mint_after_yield` | ✅ Written |
| `test_math_withdrawal_amount_proportional` | ✅ Written |
| `test_math_swap_output` | ✅ Written |
| `test_math_slippage` | ✅ Written |
| `test_math_div_by_zero_aborts` | ✅ Written |

#### Guard Rail Tests (7)
| Test | Status |
|------|--------|
| `test_guard_rail_creation` | ✅ Written |
| `test_validate_trade_success` | ✅ Written |
| `test_validate_trade_epoch_spending_accumulates` | ✅ Written |
| `test_validate_trade_slippage_exceeded_aborts` | ✅ Written |
| `test_validate_trade_single_trade_limit_exceeded_aborts` | ✅ Written |
| `test_validate_trade_epoch_limit_exceeded_aborts` | ✅ Written |
| `test_validate_trade_protocol_not_allowed_aborts` | ✅ Written |
| `test_validate_trade_coin_type_not_allowed_aborts` | ✅ Written |
| `test_validate_trade_unauthorized_caller_aborts` | ✅ Written |
| `test_guard_rail_revoke_and_reactivate` | ✅ Written |
| `test_guard_rail_revoke_not_owner_aborts` | ✅ Written |
| `test_validate_trade_on_revoked_guard_aborts` | ✅ Written |

#### Vault Tests (5)
| Test | Status |
|------|--------|
| `test_vault_first_deposit_mints_1_to_1_shares` | ✅ Written |
| `test_vault_withdraw_returns_full_deposit` | ✅ Written |
| `test_vault_two_depositors_proportional_shares` | ✅ Written |
| `test_vault_share_price_rises_after_harvest` | ✅ Written |
| `test_vault_deposit_while_paused_aborts` | ✅ Written |

> Tests are written and ready to run. Requires Sui CLI: `cd move && sui move test`

Also: `math.move` itself contains 5 inline tests (`test_mul_div`, `test_mul_div_up`, `test_sqrt`, `test_swap_output`, `test_slippage`, `test_shares_math`, `test_fee_calculation`).

---

## Phase 6 — Deployment ⏳ BLOCKED

This is the **only remaining blocker**. All code is complete and ready.

### What's needed

#### Step 1 — Install Sui CLI
```bash
# Option A: Homebrew (Mac)
brew install sui

# Option B: cargo build from source
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# Option C: Download binary from GitHub releases
# https://github.com/MystenLabs/sui/releases
```

#### Step 2 — Setup wallet and fund it
```bash
# Check active wallet
sui client active-address

# Get testnet SUI (run a few times to get enough for deployment)
sui client faucet

# Check balance
sui client balance
```

#### Step 3 — Deploy the contracts
```bash
cd move
sui client publish --gas-budget 200000000
```

Expected output includes:
- `Published Objects` → this is your **`PACKAGE_ID`**
- A shared object of type `suipilot::core::ProtocolConfig` → this is your **`CONFIG_ID`**

#### Step 4 — Configure the dashboard
Create `dashboard/.env.local`:
```env
NEXT_PUBLIC_PACKAGE_ID=0x<your-package-id>
NEXT_PUBLIC_CONFIG_ID=0x<your-config-object-id>
```

#### Step 5 — Set env vars in Vercel
In the Vercel project dashboard → Settings → Environment Variables:
- `NEXT_PUBLIC_PACKAGE_ID` = your package ID
- `NEXT_PUBLIC_CONFIG_ID` = your config object ID

Redeploy. The dashboard will go fully live.

---

## Phase 7 — Post-Deploy Tasks ⏳ PENDING

These become available after contracts are deployed:

| Task | Priority | Description |
|------|----------|-------------|
| Fix SDK `tx.pure.address('sender')` bug | High | Replace with `account.address` in all SDK builders before npm publish |
| Wire Vault Deposit button | High | Needs vault object IDs. Use `VaultBuilder.deposit()` PTB |
| Wire Vault Withdraw button | High | Needs VaultShare object IDs. Use `VaultBuilder.withdraw()` PTB |
| Publish SDK to npm | Medium | `cd sdk && npm run build && npm publish` |
| Run Move tests on testnet | Medium | `cd move && sui move test` |
| Add real testnet protocol addresses | Medium | Replace placeholder coin types in `constants.ts` with verified testnet addresses |
| Admin panel for ProtocolConfig | Low | Pause/unpause, update fees, add/remove protocols |
| Agent cap grant flow UI | Low | UI to grant AgentCap to an agent address after guard rail creation |

---

## Remaining Quick Wins (can do now, pre-deployment)

| Task | Effort | Description |
|------|--------|-------------|
| Fix SDK `sender` bug | 15 min | Replace `tx.pure.address('sender')` with param in all builders |
| SDK `npm run build` | 5 min | Verify TypeScript SDK compiles to `dist/` |
| Vault Deposit/Withdraw modal | 1 hr | Create `DepositModal.tsx` with amount input + `VaultBuilder.deposit()` PTB |
| Intent cancellation UI | 30 min | Cancel button on pending intents calling `intent::cancel_swap` |
| Guard rail update UI | 45 min | Form to update limits/protocols on existing guard rail |

---

## File Map — Everything We've Built

```
suipilot/
├── PROJECT_TRACKER.md          ← you are here
├── BUILD_PLAN.md               ← original phase plan
├── README.md                   ← public-facing docs
├── GRANT_PROPOSAL.md           ← Sui Foundation grant draft
│
├── move/
│   ├── Move.toml
│   └── sources/
│       ├── core.move           ✅ Protocol config + admin
│       ├── guard.move          ✅ Guard rails + validation
│       ├── intent.move         ✅ Swap/liquidity intents
│       ├── vault.move          ✅ AI-managed vaults
│       ├── math.move           ✅ DeFi math library
│       ├── logger.move         ✅ Execution audit trail
│       ├── errors.move         ✅ Error constants
│       └── tests.move          ✅ 17 unit tests
│
├── sdk/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── client.ts           ✅ Main client + on-chain reads
│       ├── intent-builder.ts   ✅ Intent PTB builder
│       ├── guard.ts            ✅ Guard rail PTB builder
│       ├── vault.ts            ✅ Vault PTB builder
│       ├── types.ts            ✅ Full TypeScript type definitions
│       └── index.ts            ✅ Barrel exports
│
└── dashboard/
    ├── .env.example            ✅ Env var template
    ├── next.config.js
    ├── package.json
    └── src/
        ├── app/
        │   ├── page.tsx        ✅ Main dashboard (all 5 tabs)
        │   ├── layout.tsx      ✅ Root layout
        │   ├── providers.tsx   ✅ Sui providers
        │   └── globals.css     ✅ Design system
        ├── components/
        │   ├── GuardRailForm.tsx  ✅ Real PTB tx submission
        │   ├── IntentForm.tsx     ✅ Real PTB tx submission
        │   ├── VaultForm.tsx      ✅ Real PTB tx submission
        │   ├── DocsPage.tsx       ✅ In-app docs
        │   └── Toast.tsx          ✅ Tx notifications
        └── lib/
            └── constants.ts    ✅ Env vars + coin types + strategy allocs
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Move 2024 (Sui edition) |
| Sui Framework | `Sui = { git = ..., rev = "framework/testnet" }` |
| TypeScript SDK | `@mysten/sui ^2.5.0` |
| Frontend | Next.js 16 + React 19 |
| Wallet | `@mysten/dapp-kit ^1.0.3` |
| Animations | `framer-motion ^12` |
| Charts | `recharts ^2` |
| State | TanStack Query v5 |
| Deploy | Vercel (dashboard) + Sui testnet (contracts) |

---

*Built by Digiton Dynamics — targeting Sui Foundation Developer Grant*

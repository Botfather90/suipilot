/**
 * @suipilot/sdk
 *
 * TypeScript SDK for the SuiPilot AI DeFi Execution Protocol on Sui.
 *
 * Usage:
 * ```ts
 * import { SuiPilotClient } from '@suipilot/sdk';
 *
 * const pilot = new SuiPilotClient({
 *   network: 'testnet',
 *   packageId: '0x...',
 *   configId: '0x...',
 * });
 *
 * // Create a guard rail for your AI agent
 * const guardTx = pilot.guards.createGuardRail({
 *   maxSlippageBps: 100,       // 1% max slippage
 *   maxSingleTrade: 10_000_000_000n, // 10 SUI
 *   epochSpendingLimit: 50_000_000_000n, // 50 SUI per epoch
 *   allowedProtocols: ['cetus', 'turbos', 'deepbook'],
 *   allowedCoinTypes: [],       // empty = allow all
 *   agent: '0xAGENT_ADDRESS',
 * });
 *
 * // Create a swap intent (validated against guard rail)
 * const swapTx = pilot.intents.createSwapIntent({
 *   guardRailId: '0xGUARD_ID',
 *   coinTypeIn: '0x2::sui::SUI',
 *   coinTypeOut: '0xUSDC_TYPE',
 *   amountIn: 1_000_000_000n,  // 1 SUI
 *   minAmountOut: 900_000n,    // 0.9 USDC minimum
 *   maxSlippageBps: 50,        // 0.5%
 * });
 * ```
 */

export { SuiPilotClient } from './client';
export { IntentBuilder } from './intent-builder';
export { GuardBuilder } from './guard';
export { VaultBuilder } from './vault';
export {
  IntentStatus,
  LiquidityAction,
  type SwapIntent,
  type LiquidityIntent,
  type GuardRail,
  type GuardRailConfig,
  type AgentCap,
  type VaultInfo,
  type VaultShare,
  type VaultStrategy,
  type ProtocolConfig,
  type SuiPilotConfig,
  type SuiNetwork,
  type TxResult,
  type CreateSwapIntentParams,
  type CreateLiquidityIntentParams,
  type CreateGuardRailParams,
  type CreateVaultParams,
  type DepositParams,
  type WithdrawParams,
  type SwapIntentCreatedEvent,
  type SwapExecutedEvent,
  type TradeValidatedEvent,
  type DepositedEvent,
  type WithdrawnEvent,
  type HarvestedEvent,
} from './types';

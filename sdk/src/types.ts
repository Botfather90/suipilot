/**
 * SuiPilot SDK — Type Definitions
 *
 * Mirror of on-chain Move structs for TypeScript consumption.
 * All IDs are hex strings (0x-prefixed Sui object IDs).
 */

// === Intent Types ===

export const IntentStatus = {
  PENDING: 0,
  EXECUTED: 1,
  FAILED: 2,
  EXPIRED: 3,
  CANCELLED: 4,
} as const;
export type IntentStatusValue = typeof IntentStatus[keyof typeof IntentStatus];

export const LiquidityAction = {
  ADD: 0,
  REMOVE: 1,
} as const;
export type LiquidityActionValue = typeof LiquidityAction[keyof typeof LiquidityAction];

export interface SwapIntent {
  id: string;
  agent: string;
  user: string;
  guardRailId: string;
  coinTypeIn: string;
  coinTypeOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  maxSlippageBps: number;
  preferredProtocol: string | null;
  createdAtEpoch: number;
  expiresAtEpoch: number;
  status: IntentStatusValue;
}

export interface LiquidityIntent {
  id: string;
  agent: string;
  user: string;
  guardRailId: string;
  poolId: string;
  coinTypeA: string;
  coinTypeB: string;
  amountA: bigint;
  amountB: bigint;
  minLpOut: bigint;
  action: LiquidityActionValue;
  createdAtEpoch: number;
  expiresAtEpoch: number;
  status: IntentStatusValue;
}

// === Guard Rail Types ===

export interface GuardRailConfig {
  maxSlippageBps: number;
  maxSingleTrade: bigint;
  epochSpendingLimit: bigint;
  allowedProtocols: string[];
  allowedCoinTypes: string[];
  agent: string;
}

export interface GuardRail extends GuardRailConfig {
  id: string;
  owner: string;
  epochSpent: bigint;
  lastEpoch: number;
  active: boolean;
}

export interface AgentCap {
  id: string;
  guardRailId: string;
  agent: string;
  grantedAtEpoch: number;
}

// === Vault Types ===

export interface VaultStrategy {
  targetAllocLp: number;
  targetAllocStake: number;
  targetAllocLend: number;
  targetAllocIdle: number;
  rebalanceThreshold: number;
  maxSingleAlloc: number;
}

export interface VaultInfo {
  id: string;
  coinType: string;
  balance: bigint;
  totalShares: bigint;
  strategy: VaultStrategy;
  paused: boolean;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  totalYield: bigint;
  performanceFeeBps: number;
  managementFeeBps: number;
  lastHarvestEpoch: number;
  feeBalance: bigint;
}

export interface VaultShare {
  id: string;
  vaultId: string;
  shares: bigint;
  depositedAtEpoch: number;
  depositAmount: bigint;
}

// === Protocol Config ===

export interface ProtocolConfig {
  id: string;
  version: number;
  paused: boolean;
  feeBps: number;
  treasury: string;
  supportedProtocols: string[];
  totalIntentsExecuted: bigint;
  totalVolume: bigint;
}

// === Events ===

export interface SwapIntentCreatedEvent {
  intentId: string;
  agent: string;
  user: string;
  coinTypeIn: string;
  coinTypeOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
}

export interface SwapExecutedEvent {
  intentId: string;
  amountIn: bigint;
  amountOut: bigint;
  protocol: string;
}

export interface TradeValidatedEvent {
  guardRailId: string;
  amount: bigint;
  epochSpentAfter: bigint;
}

export interface DepositedEvent {
  vaultId: string;
  user: string;
  amount: bigint;
  sharesMinted: bigint;
  totalShares: bigint;
  totalBalance: bigint;
}

export interface WithdrawnEvent {
  vaultId: string;
  user: string;
  sharesBurned: bigint;
  amountReturned: bigint;
  totalShares: bigint;
  totalBalance: bigint;
}

export interface HarvestedEvent {
  vaultId: string;
  yieldAmount: bigint;
  feeTaken: bigint;
  newTotalBalance: bigint;
  epoch: number;
}

// === SDK Config ===

export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

export interface SuiPilotConfig {
  /** Sui network to connect to */
  network: SuiNetwork;
  /** Deployed package ID (0x...) */
  packageId: string;
  /** ProtocolConfig shared object ID */
  configId: string;
  /** Custom RPC URL (overrides network default) */
  rpcUrl?: string;
}

// === Transaction Result ===

export interface TxResult {
  digest: string;
  effects: {
    status: 'success' | 'failure';
    gasUsed: bigint;
  };
  events: Record<string, unknown>[];
  objectChanges: {
    type: 'created' | 'mutated' | 'deleted';
    objectId: string;
    objectType: string;
  }[];
}

// === Builder Params ===

export interface CreateSwapIntentParams {
  guardRailId: string;
  coinTypeIn: string;
  coinTypeOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  maxSlippageBps: number;
  preferredProtocol?: string;
  ttlEpochs?: number;
}

export interface CreateLiquidityIntentParams {
  guardRailId: string;
  poolId: string;
  coinTypeA: string;
  coinTypeB: string;
  amountA: bigint;
  amountB: bigint;
  minLpOut: bigint;
  action: LiquidityActionValue;
  ttlEpochs?: number;
}

export interface CreateGuardRailParams {
  maxSlippageBps: number;
  maxSingleTrade: bigint;
  epochSpendingLimit: bigint;
  allowedProtocols: string[];
  allowedCoinTypes: string[];
  agent: string;
}

export interface CreateVaultParams {
  coinType: string;
  strategy: VaultStrategy;
  performanceFeeBps: number;
  managementFeeBps: number;
}

export interface DepositParams {
  vaultId: string;
  coinType: string;
  coinObjectId: string;
}

export interface WithdrawParams {
  vaultId: string;
  coinType: string;
  shareObjectId: string;
}

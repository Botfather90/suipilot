/**
 * SuiPilot SDK — Main Client
 *
 * Unified interface to the SuiPilot protocol.
 * Wraps IntentBuilder, GuardBuilder, VaultBuilder with
 * on-chain reads and transaction signing.
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { IntentBuilder } from './intent-builder';
import { GuardBuilder } from './guard';
import { VaultBuilder } from './vault';
import type {
  SuiPilotConfig,
  SuiNetwork,
  ProtocolConfig,
  GuardRail,
  SwapIntent,
  VaultInfo,
  VaultShare,
  TxResult,
  IntentStatusValue,
  IntentStatus,
} from './types';

const NETWORK_URLS: Record<SuiNetwork, string> = {
  mainnet: getFullnodeUrl('mainnet'),
  testnet: getFullnodeUrl('testnet'),
  devnet: getFullnodeUrl('devnet'),
  localnet: 'http://127.0.0.1:9000',
};

export class SuiPilotClient {
  public readonly client: SuiClient;
  public readonly intents: IntentBuilder;
  public readonly guards: GuardBuilder;
  public readonly vaults: VaultBuilder;
  private readonly config: SuiPilotConfig;

  constructor(config: SuiPilotConfig) {
    this.config = config;
    const rpcUrl = config.rpcUrl ?? NETWORK_URLS[config.network];
    this.client = new SuiClient({ url: rpcUrl });
    this.intents = new IntentBuilder(config);
    this.guards = new GuardBuilder(config);
    this.vaults = new VaultBuilder(config);
  }

  // === Protocol Reads ===

  /**
   * Fetch the shared ProtocolConfig object.
   */
  async getProtocolConfig(): Promise<ProtocolConfig> {
    const obj = await this.client.getObject({
      id: this.config.configId,
      options: { showContent: true },
    });

    const fields = (obj.data?.content as any)?.fields;
    if (!fields) throw new Error('Failed to read ProtocolConfig');

    return {
      id: this.config.configId,
      version: Number(fields.version),
      paused: Boolean(fields.paused),
      feeBps: Number(fields.fee_bps),
      treasury: String(fields.treasury),
      supportedProtocols: (fields.supported_protocols || []).map(String),
      totalIntentsExecuted: BigInt(fields.total_intents_executed || 0),
      totalVolume: BigInt(fields.total_volume || 0),
    };
  }

  /**
   * Fetch a GuardRail by object ID.
   */
  async getGuardRail(guardRailId: string): Promise<GuardRail> {
    const obj = await this.client.getObject({
      id: guardRailId,
      options: { showContent: true },
    });

    const fields = (obj.data?.content as any)?.fields;
    if (!fields) throw new Error(`GuardRail ${guardRailId} not found`);

    return {
      id: guardRailId,
      owner: String(fields.owner),
      maxSlippageBps: Number(fields.max_slippage_bps),
      maxSingleTrade: BigInt(fields.max_single_trade),
      epochSpendingLimit: BigInt(fields.epoch_spending_limit),
      epochSpent: BigInt(fields.epoch_spent),
      lastEpoch: Number(fields.last_epoch),
      allowedProtocols: (fields.allowed_protocols || []).map(String),
      allowedCoinTypes: (fields.allowed_coin_types || []).map(String),
      agent: String(fields.agent),
      active: Boolean(fields.active),
    };
  }

  /**
   * Fetch a SwapIntent by object ID.
   */
  async getSwapIntent(intentId: string): Promise<SwapIntent> {
    const obj = await this.client.getObject({
      id: intentId,
      options: { showContent: true },
    });

    const fields = (obj.data?.content as any)?.fields;
    if (!fields) throw new Error(`SwapIntent ${intentId} not found`);

    return {
      id: intentId,
      agent: String(fields.agent),
      user: String(fields.user),
      guardRailId: String(fields.guard_rail_id),
      coinTypeIn: String(fields.coin_type_in),
      coinTypeOut: String(fields.coin_type_out),
      amountIn: BigInt(fields.amount_in),
      minAmountOut: BigInt(fields.min_amount_out),
      maxSlippageBps: Number(fields.max_slippage_bps),
      preferredProtocol: fields.preferred_protocol?.fields?.vec?.[0] ?? null,
      createdAtEpoch: Number(fields.created_at_epoch),
      expiresAtEpoch: Number(fields.expires_at_epoch),
      status: Number(fields.status) as IntentStatusValue,
    };
  }

  /**
   * Fetch a Vault by object ID.
   */
  async getVault(vaultId: string, coinType: string): Promise<VaultInfo> {
    const obj = await this.client.getObject({
      id: vaultId,
      options: { showContent: true },
    });

    const fields = (obj.data?.content as any)?.fields;
    if (!fields) throw new Error(`Vault ${vaultId} not found`);

    const strategy = fields.strategy?.fields || {};
    return {
      id: vaultId,
      coinType,
      balance: BigInt(fields.balance || 0),
      totalShares: BigInt(fields.total_shares || 0),
      strategy: {
        targetAllocLp: Number(strategy.target_alloc_lp || 0),
        targetAllocStake: Number(strategy.target_alloc_stake || 0),
        targetAllocLend: Number(strategy.target_alloc_lend || 0),
        targetAllocIdle: Number(strategy.target_alloc_idle || 0),
        rebalanceThreshold: Number(strategy.rebalance_threshold || 0),
        maxSingleAlloc: Number(strategy.max_single_alloc || 0),
      },
      paused: Boolean(fields.paused),
      totalDeposited: BigInt(fields.total_deposited || 0),
      totalWithdrawn: BigInt(fields.total_withdrawn || 0),
      totalYield: BigInt(fields.total_yield || 0),
      performanceFeeBps: Number(fields.performance_fee_bps),
      managementFeeBps: Number(fields.management_fee_bps),
      lastHarvestEpoch: Number(fields.last_harvest_epoch),
      feeBalance: BigInt(fields.fee_balance || 0),
    };
  }

  /**
   * Get all VaultShare objects owned by an address.
   */
  async getVaultShares(owner: string, coinType: string): Promise<VaultShare[]> {
    const type = `${this.config.packageId}::vault::VaultShare<${coinType}>`;
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: { StructType: type },
      options: { showContent: true },
    });

    return (objects.data || []).map(obj => {
      const fields = (obj.data?.content as any)?.fields;
      return {
        id: obj.data?.objectId || '',
        vaultId: String(fields?.vault_id || ''),
        shares: BigInt(fields?.shares || 0),
        depositedAtEpoch: Number(fields?.deposited_at_epoch || 0),
        depositAmount: BigInt(fields?.deposit_amount || 0),
      };
    });
  }

  /**
   * Get all GuardRails owned by an address.
   */
  async getOwnedGuardRails(owner: string): Promise<GuardRail[]> {
    const type = `${this.config.packageId}::guard::GuardRail`;
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: { StructType: type },
      options: { showContent: true },
    });

    return (objects.data || []).map(obj => {
      const fields = (obj.data?.content as any)?.fields;
      return {
        id: obj.data?.objectId || '',
        owner: String(fields?.owner || ''),
        maxSlippageBps: Number(fields?.max_slippage_bps || 0),
        maxSingleTrade: BigInt(fields?.max_single_trade || 0),
        epochSpendingLimit: BigInt(fields?.epoch_spending_limit || 0),
        epochSpent: BigInt(fields?.epoch_spent || 0),
        lastEpoch: Number(fields?.last_epoch || 0),
        allowedProtocols: (fields?.allowed_protocols || []).map(String),
        allowedCoinTypes: (fields?.allowed_coin_types || []).map(String),
        agent: String(fields?.agent || ''),
        active: Boolean(fields?.active),
      };
    });
  }

  /**
   * Get all pending SwapIntents owned by an address (agent).
   */
  async getPendingIntents(agent: string): Promise<SwapIntent[]> {
    const type = `${this.config.packageId}::intent::SwapIntent`;
    const objects = await this.client.getOwnedObjects({
      owner: agent,
      filter: { StructType: type },
      options: { showContent: true },
    });

    return (objects.data || [])
      .map(obj => {
        const fields = (obj.data?.content as any)?.fields;
        return {
          id: obj.data?.objectId || '',
          agent: String(fields?.agent || ''),
          user: String(fields?.user || ''),
          guardRailId: String(fields?.guard_rail_id || ''),
          coinTypeIn: String(fields?.coin_type_in || ''),
          coinTypeOut: String(fields?.coin_type_out || ''),
          amountIn: BigInt(fields?.amount_in || 0),
          minAmountOut: BigInt(fields?.min_amount_out || 0),
          maxSlippageBps: Number(fields?.max_slippage_bps || 0),
          preferredProtocol: fields?.preferred_protocol?.fields?.vec?.[0] ?? null,
          createdAtEpoch: Number(fields?.created_at_epoch || 0),
          expiresAtEpoch: Number(fields?.expires_at_epoch || 0),
          status: Number(fields?.status || 0) as IntentStatusValue,
        };
      })
      .filter(i => i.status === 0); // PENDING only
  }

  /**
   * Subscribe to SuiPilot events (SwapExecuted, Deposited, etc.)
   * Returns an unsubscribe function.
   */
  async subscribeToEvents(
    eventType: string,
    callback: (event: Record<string, unknown>) => void,
  ): Promise<() => void> {
    const unsub = await this.client.subscribeEvent({
      filter: {
        MoveEventType: `${this.config.packageId}::${eventType}`,
      },
      onMessage: (event) => {
        callback(event.parsedJson as Record<string, unknown>);
      },
    });
    return () => unsub();
  }

  // === Utility ===

  /**
   * Get the package ID.
   */
  get packageId(): string {
    return this.config.packageId;
  }

  /**
   * Get the network.
   */
  get network(): SuiNetwork {
    return this.config.network;
  }

  /**
   * Get the underlying SuiClient for custom queries.
   */
  get suiClient(): SuiClient {
    return this.client;
  }
}

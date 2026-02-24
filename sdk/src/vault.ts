/**
 * SuiPilot SDK — Vault Builder
 *
 * Create and manage AI-managed vaults with strategy configuration.
 */

import { Transaction } from '@mysten/sui/transactions';
import type {
  CreateVaultParams,
  DepositParams,
  WithdrawParams,
  VaultStrategy,
  SuiPilotConfig,
} from './types';

export class VaultBuilder {
  constructor(private config: SuiPilotConfig) {}

  /**
   * Create a new vault with a strategy and fee configuration.
   * Returns a VaultAdminCap to the creator.
   */
  createVault(params: CreateVaultParams): Transaction {
    const tx = new Transaction();
    const { strategy: s, coinType } = params;

    // Build strategy struct
    const strategy = tx.moveCall({
      target: `${this.config.packageId}::vault::new_strategy`,
      arguments: [
        tx.pure.u64(s.targetAllocLp),
        tx.pure.u64(s.targetAllocStake),
        tx.pure.u64(s.targetAllocLend),
        tx.pure.u64(s.targetAllocIdle),
        tx.pure.u64(s.rebalanceThreshold),
        tx.pure.u64(s.maxSingleAlloc),
      ],
    });

    const adminCap = tx.moveCall({
      target: `${this.config.packageId}::vault::create_vault`,
      typeArguments: [coinType],
      arguments: [
        strategy,
        tx.pure.u64(params.performanceFeeBps),
        tx.pure.u64(params.managementFeeBps),
      ],
    });

    tx.transferObjects([adminCap], tx.pure.address('sender'));
    return tx;
  }

  /**
   * Deposit coins into a vault. Returns a VaultShare to the depositor.
   */
  deposit(params: DepositParams): Transaction {
    const tx = new Transaction();

    const share = tx.moveCall({
      target: `${this.config.packageId}::vault::deposit`,
      typeArguments: [params.coinType],
      arguments: [
        tx.object(params.vaultId),
        tx.object(params.coinObjectId),
      ],
    });

    tx.transferObjects([share], tx.pure.address('sender'));
    return tx;
  }

  /**
   * Withdraw from a vault by burning a VaultShare.
   * Returns the proportional coin balance.
   */
  withdraw(params: WithdrawParams): Transaction {
    const tx = new Transaction();

    const coin = tx.moveCall({
      target: `${this.config.packageId}::vault::withdraw`,
      typeArguments: [params.coinType],
      arguments: [
        tx.object(params.vaultId),
        tx.object(params.shareObjectId),
      ],
    });

    tx.transferObjects([coin], tx.pure.address('sender'));
    return tx;
  }

  /**
   * Admin harvests yield into the vault, taking performance fee.
   */
  harvest(
    vaultId: string,
    adminCapId: string,
    profitCoinId: string,
    coinType: string,
  ): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::vault::harvest`,
      typeArguments: [coinType],
      arguments: [
        tx.object(vaultId),
        tx.object(adminCapId),
        tx.object(profitCoinId),
      ],
    });
    return tx;
  }

  /**
   * Admin collects accumulated fees from the vault.
   */
  collectFees(
    vaultId: string,
    adminCapId: string,
    coinType: string,
  ): Transaction {
    const tx = new Transaction();
    const feeCoin = tx.moveCall({
      target: `${this.config.packageId}::vault::collect_fees`,
      typeArguments: [coinType],
      arguments: [
        tx.object(vaultId),
        tx.object(adminCapId),
      ],
    });
    tx.transferObjects([feeCoin], tx.pure.address('sender'));
    return tx;
  }

  /**
   * Update vault strategy (admin only).
   */
  updateStrategy(
    vaultId: string,
    adminCapId: string,
    strategy: VaultStrategy,
    coinType: string,
  ): Transaction {
    const tx = new Transaction();
    const strat = tx.moveCall({
      target: `${this.config.packageId}::vault::new_strategy`,
      arguments: [
        tx.pure.u64(strategy.targetAllocLp),
        tx.pure.u64(strategy.targetAllocStake),
        tx.pure.u64(strategy.targetAllocLend),
        tx.pure.u64(strategy.targetAllocIdle),
        tx.pure.u64(strategy.rebalanceThreshold),
        tx.pure.u64(strategy.maxSingleAlloc),
      ],
    });
    tx.moveCall({
      target: `${this.config.packageId}::vault::update_strategy`,
      typeArguments: [coinType],
      arguments: [
        tx.object(vaultId),
        tx.object(adminCapId),
        strat,
      ],
    });
    return tx;
  }

  /**
   * Pause vault (admin only). Blocks deposits and withdrawals.
   */
  pause(vaultId: string, adminCapId: string, coinType: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::vault::pause_vault`,
      typeArguments: [coinType],
      arguments: [tx.object(vaultId), tx.object(adminCapId)],
    });
    return tx;
  }

  /**
   * Unpause vault (admin only).
   */
  unpause(vaultId: string, adminCapId: string, coinType: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::vault::unpause_vault`,
      typeArguments: [coinType],
      arguments: [tx.object(vaultId), tx.object(adminCapId)],
    });
    return tx;
  }
}

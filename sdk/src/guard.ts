/**
 * SuiPilot SDK — Guard Rail Builder
 *
 * Create and manage user guard rails that constrain agent behavior.
 */

import { Transaction } from '@mysten/sui/transactions';
import type { CreateGuardRailParams, SuiPilotConfig } from './types';

export class GuardBuilder {
  constructor(private config: SuiPilotConfig) {}

  /**
   * Create a new GuardRail owned by the caller.
   * The agent address is authorized to trade within the specified constraints.
   */
  createGuardRail(params: CreateGuardRailParams): Transaction {
    const tx = new Transaction();

    // Build protocol vector
    const protocols = tx.makeMoveVec({
      type: '0x1::string::String',
      elements: params.allowedProtocols.map(p => tx.pure.string(p)),
    });

    // Build coin type vector
    const coinTypes = tx.makeMoveVec({
      type: '0x1::string::String',
      elements: params.allowedCoinTypes.map(c => tx.pure.string(c)),
    });

    const guard = tx.moveCall({
      target: `${this.config.packageId}::guard::create_guard_rail`,
      arguments: [
        tx.pure.u64(params.maxSlippageBps),
        tx.pure.u64(params.maxSingleTrade),
        tx.pure.u64(params.epochSpendingLimit),
        protocols,
        coinTypes,
        tx.pure.address(params.agent),
      ],
    });

    // Transfer guard rail to sender (owner keeps it)
    tx.transferObjects([guard], tx.pure.address('sender'));
    return tx;
  }

  /**
   * Grant an AgentCap to the authorized agent.
   * Only the guard rail owner can call this.
   */
  grantAgentCap(guardRailId: string, agentAddress: string): Transaction {
    const tx = new Transaction();

    const cap = tx.moveCall({
      target: `${this.config.packageId}::guard::grant_agent_cap`,
      arguments: [tx.object(guardRailId)],
    });

    // Transfer the capability to the agent
    tx.transferObjects([cap], tx.pure.address(agentAddress));
    return tx;
  }

  /**
   * Revoke agent access. Disables the guard rail.
   */
  revokeAgent(guardRailId: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::guard::revoke_agent`,
      arguments: [tx.object(guardRailId)],
    });
    return tx;
  }

  /**
   * Reactivate a guard rail with a new agent.
   */
  reactivate(guardRailId: string, newAgent: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::guard::reactivate`,
      arguments: [
        tx.object(guardRailId),
        tx.pure.address(newAgent),
      ],
    });
    return tx;
  }

  /**
   * Update guard rail spending/slippage limits.
   */
  updateLimits(
    guardRailId: string,
    maxSlippageBps: number,
    maxSingleTrade: bigint,
    epochSpendingLimit: bigint,
  ): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::guard::update_limits`,
      arguments: [
        tx.object(guardRailId),
        tx.pure.u64(maxSlippageBps),
        tx.pure.u64(maxSingleTrade),
        tx.pure.u64(epochSpendingLimit),
      ],
    });
    return tx;
  }

  /**
   * Update allowed protocols whitelist.
   */
  updateAllowedProtocols(guardRailId: string, protocols: string[]): Transaction {
    const tx = new Transaction();
    const vec = tx.makeMoveVec({
      type: '0x1::string::String',
      elements: protocols.map(p => tx.pure.string(p)),
    });
    tx.moveCall({
      target: `${this.config.packageId}::guard::update_allowed_protocols`,
      arguments: [tx.object(guardRailId), vec],
    });
    return tx;
  }

  /**
   * Update allowed coin types whitelist.
   */
  updateAllowedCoins(guardRailId: string, coinTypes: string[]): Transaction {
    const tx = new Transaction();
    const vec = tx.makeMoveVec({
      type: '0x1::string::String',
      elements: coinTypes.map(c => tx.pure.string(c)),
    });
    tx.moveCall({
      target: `${this.config.packageId}::guard::update_allowed_coins`,
      arguments: [tx.object(guardRailId), vec],
    });
    return tx;
  }
}

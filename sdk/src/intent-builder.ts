/**
 * SuiPilot SDK — Intent Builder
 *
 * Type-safe transaction builder for creating and managing intents.
 * Composes Sui Programmable Transaction Blocks (PTBs).
 */

import { Transaction } from '@mysten/sui/transactions';
import type {
  CreateSwapIntentParams,
  CreateLiquidityIntentParams,
  SuiPilotConfig,
} from './types';

export class IntentBuilder {
  constructor(private config: SuiPilotConfig) {}

  /**
   * Build a transaction to create a SwapIntent.
   * The intent is validated against the user's GuardRail on-chain.
   */
  createSwapIntent(params: CreateSwapIntentParams): Transaction {
    const tx = new Transaction();

    const args = [
      tx.object(this.config.configId),
      tx.object(params.guardRailId),
      tx.pure.string(params.coinTypeIn),
      tx.pure.string(params.coinTypeOut),
      tx.pure.u64(params.amountIn),
      tx.pure.u64(params.minAmountOut),
      tx.pure.u64(params.maxSlippageBps),
    ];

    // Optional preferred protocol
    if (params.preferredProtocol) {
      args.push(
        tx.moveCall({
          target: '0x1::option::some',
          typeArguments: ['0x1::string::String'],
          arguments: [tx.pure.string(params.preferredProtocol)],
        })
      );
    } else {
      args.push(
        tx.moveCall({
          target: '0x1::option::none',
          typeArguments: ['0x1::string::String'],
          arguments: [],
        })
      );
    }

    args.push(tx.pure.u64(params.ttlEpochs ?? 10));

    const intent = tx.moveCall({
      target: `${this.config.packageId}::intent::create_swap_intent`,
      arguments: args,
    });

    // Transfer the intent to the sender (agent keeps it to execute later)
    tx.transferObjects([intent], tx.pure.address('sender'));

    return tx;
  }

  /**
   * Build a transaction to execute a SwapIntent after the on-chain swap.
   * Call this after performing the actual DEX swap in the same PTB.
   */
  executeSwapIntent(
    intentId: string,
    actualAmountOut: bigint,
    protocolUsed: string,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.config.packageId}::intent::execute_swap`,
      arguments: [
        tx.object(intentId),
        tx.object(this.config.configId),
        tx.pure.u64(actualAmountOut),
        tx.pure.string(protocolUsed),
      ],
    });

    return tx;
  }

  /**
   * Build a transaction to cancel a pending SwapIntent.
   */
  cancelSwapIntent(intentId: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::intent::cancel_swap`,
      arguments: [tx.object(intentId)],
    });
    return tx;
  }

  /**
   * Build a transaction to expire a SwapIntent past its TTL.
   * Can be called by anyone (permissionless cleanup).
   */
  expireSwapIntent(intentId: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::intent::expire_swap`,
      arguments: [tx.object(intentId)],
    });
    return tx;
  }

  /**
   * Build a transaction to fail a SwapIntent (agent only).
   */
  failSwapIntent(intentId: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::intent::fail_swap`,
      arguments: [tx.object(intentId)],
    });
    return tx;
  }

  /**
   * Build a transaction to create a LiquidityIntent.
   */
  createLiquidityIntent(params: CreateLiquidityIntentParams): Transaction {
    const tx = new Transaction();

    const intent = tx.moveCall({
      target: `${this.config.packageId}::intent::create_liquidity_intent`,
      arguments: [
        tx.object(this.config.configId),
        tx.object(params.guardRailId),
        tx.pure.address(params.poolId),
        tx.pure.string(params.coinTypeA),
        tx.pure.string(params.coinTypeB),
        tx.pure.u64(params.amountA),
        tx.pure.u64(params.amountB),
        tx.pure.u64(params.minLpOut),
        tx.pure.u8(params.action),
        tx.pure.u64(params.ttlEpochs ?? 10),
      ],
    });

    tx.transferObjects([intent], tx.pure.address('sender'));
    return tx;
  }

  /**
   * Build a transaction to execute a LiquidityIntent.
   */
  executeLiquidityIntent(
    intentId: string,
    lpAmount: bigint,
  ): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::intent::execute_liquidity`,
      arguments: [
        tx.object(intentId),
        tx.object(this.config.configId),
        tx.pure.u64(lpAmount),
      ],
    });
    return tx;
  }

  /**
   * Build a transaction to cancel a LiquidityIntent.
   */
  cancelLiquidityIntent(intentId: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::intent::cancel_liquidity`,
      arguments: [tx.object(intentId)],
    });
    return tx;
  }

  /**
   * Compose a full swap execution in a single PTB:
   * 1. Create intent (validates guard rail)
   * 2. Perform the DEX swap (caller provides the swap call)
   * 3. Mark intent as executed
   *
   * This is the typical agent flow.
   */
  composeSwapExecution(
    params: CreateSwapIntentParams,
    dexSwapCall: (tx: Transaction, coinIn: unknown) => unknown,
    protocolUsed: string,
  ): Transaction {
    const tx = new Transaction();

    // Step 1: Create intent
    const args = [
      tx.object(this.config.configId),
      tx.object(params.guardRailId),
      tx.pure.string(params.coinTypeIn),
      tx.pure.string(params.coinTypeOut),
      tx.pure.u64(params.amountIn),
      tx.pure.u64(params.minAmountOut),
      tx.pure.u64(params.maxSlippageBps),
    ];

    if (params.preferredProtocol) {
      args.push(
        tx.moveCall({
          target: '0x1::option::some',
          typeArguments: ['0x1::string::String'],
          arguments: [tx.pure.string(params.preferredProtocol)],
        })
      );
    } else {
      args.push(
        tx.moveCall({
          target: '0x1::option::none',
          typeArguments: ['0x1::string::String'],
          arguments: [],
        })
      );
    }

    args.push(tx.pure.u64(params.ttlEpochs ?? 10));

    const intent = tx.moveCall({
      target: `${this.config.packageId}::intent::create_swap_intent`,
      arguments: args,
    });

    // Step 2: DEX swap (caller defines this)
    // The dexSwapCall receives the transaction and should return the output coin
    const outputCoin = dexSwapCall(tx, null);

    // Step 3: Mark executed (caller must compute actualAmountOut off-chain or read from result)
    // In practice, the agent reads the swap result and calls execute_swap separately
    // This composite is for illustration — real usage splits into 2 transactions

    tx.transferObjects([intent], tx.pure.address('sender'));

    return tx;
  }
}

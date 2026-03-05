module suipilot::intent {
    use std::string::String;
    use sui::event;
    use suipilot::guard::{Self, GuardRail};
    use suipilot::core::{Self, ProtocolConfig};

    // === Constants ===

    const STATUS_PENDING: u8 = 0;
    const STATUS_EXECUTED: u8 = 1;
    const STATUS_FAILED: u8 = 2;
    const STATUS_EXPIRED: u8 = 3;
    const STATUS_CANCELLED: u8 = 4;

    const ACTION_ADD_LIQ: u8 = 0;
    const ACTION_REMOVE_LIQ: u8 = 1;

    // === Errors ===

    const EIntentNotPending: u64 = 103;
    const EIntentExpired: u64 = 101;
    const EMinAmountNotMet: u64 = 104;
    const ENotIntentOwner: u64 = 105;
    const EIntentNotExpired: u64 = 106;

    // === Structs ===

    public struct SwapIntent has key, store {
        id: UID,
        agent: address,
        user: address,
        guard_rail_id: ID,
        coin_type_in: String,
        coin_type_out: String,
        amount_in: u64,
        min_amount_out: u64,
        max_slippage_bps: u64,
        preferred_protocol: Option<String>,
        created_at_epoch: u64,
        expires_at_epoch: u64,
        status: u8,
    }

    public struct LiquidityIntent has key, store {
        id: UID,
        agent: address,
        user: address,
        guard_rail_id: ID,
        pool_id: ID,
        coin_type_a: String,
        coin_type_b: String,
        amount_a: u64,
        amount_b: u64,
        min_lp_out: u64,
        action: u8,
        created_at_epoch: u64,
        expires_at_epoch: u64,
        status: u8,
    }

    // === Events ===

    public struct SwapIntentCreated has copy, drop {
        intent_id: ID,
        agent: address,
        user: address,
        coin_type_in: String,
        coin_type_out: String,
        amount_in: u64,
        min_amount_out: u64,
    }

    public struct SwapExecuted has copy, drop {
        intent_id: ID,
        amount_in: u64,
        amount_out: u64,
        protocol: String,
    }

    public struct IntentCancelled has copy, drop {
        intent_id: ID,
    }

    public struct IntentExpired has copy, drop {
        intent_id: ID,
    }

    public struct LiquidityIntentCreated has copy, drop {
        intent_id: ID,
        agent: address,
        action: u8,
        amount_a: u64,
        amount_b: u64,
    }

    public struct LiquidityExecuted has copy, drop {
        intent_id: ID,
        action: u8,
        lp_amount: u64,
    }

    // === Swap Intent Functions ===

    /// Agent creates a swap intent, validated against guard rail
    public fun create_swap_intent(
        config: &ProtocolConfig,
        guard: &mut GuardRail,
        coin_type_in: String,
        coin_type_out: String,
        amount_in: u64,
        min_amount_out: u64,
        max_slippage_bps: u64,
        preferred_protocol: Option<String>,
        ttl_epochs: u64,
        ctx: &mut TxContext,
    ): SwapIntent {
        core::assert_not_paused(config);

        // Validate against guard rail (checks agent auth, slippage, spending, protocols)
        let protocol_for_check = if (preferred_protocol.is_some()) {
            *preferred_protocol.borrow()
        } else {
            std::string::utf8(b"any")
        };

        guard::validate_trade(
            guard,
            amount_in,
            max_slippage_bps,
            &protocol_for_check,
            &coin_type_in,
            ctx,
        );

        let intent = SwapIntent {
            id: object::new(ctx),
            agent: ctx.sender(),
            user: guard::owner(guard),
            guard_rail_id: object::id(guard),
            coin_type_in,
            coin_type_out,
            amount_in,
            min_amount_out,
            max_slippage_bps,
            preferred_protocol,
            created_at_epoch: ctx.epoch(),
            expires_at_epoch: ctx.epoch() + ttl_epochs,
            status: STATUS_PENDING,
        };

        event::emit(SwapIntentCreated {
            intent_id: object::id(&intent),
            agent: ctx.sender(),
            user: guard::owner(guard),
            coin_type_in: intent.coin_type_in,
            coin_type_out: intent.coin_type_out,
            amount_in,
            min_amount_out,
        });

        intent
    }

    /// Mark swap intent as executed after successful on-chain swap
    public fun execute_swap(
        intent: &mut SwapIntent,
        config: &mut ProtocolConfig,
        actual_amount_out: u64,
        protocol_used: String,
        ctx: &TxContext,
    ) {
        assert!(intent.status == STATUS_PENDING, EIntentNotPending);
        assert!(ctx.epoch() <= intent.expires_at_epoch, EIntentExpired);
        assert!(actual_amount_out >= intent.min_amount_out, EMinAmountNotMet);

        intent.status = STATUS_EXECUTED;

        // Record in protocol stats
        core::record_intent_execution(config, intent.amount_in);

        event::emit(SwapExecuted {
            intent_id: object::id(intent),
            amount_in: intent.amount_in,
            amount_out: actual_amount_out,
            protocol: protocol_used,
        });
    }

    /// Mark intent as failed
    public fun fail_swap(intent: &mut SwapIntent, ctx: &TxContext) {
        assert!(intent.status == STATUS_PENDING, EIntentNotPending);
        assert!(ctx.sender() == intent.agent, ENotIntentOwner);
        intent.status = STATUS_FAILED;
    }

    /// Agent or user cancels a pending intent
    public fun cancel_swap(intent: &mut SwapIntent, ctx: &TxContext) {
        assert!(intent.status == STATUS_PENDING, EIntentNotPending);
        assert!(
            ctx.sender() == intent.agent || ctx.sender() == intent.user,
            ENotIntentOwner,
        );
        intent.status = STATUS_CANCELLED;
        event::emit(IntentCancelled { intent_id: object::id(intent) });
    }

    /// Anyone can expire an intent past its TTL
    public fun expire_swap(intent: &mut SwapIntent, ctx: &TxContext) {
        assert!(intent.status == STATUS_PENDING, EIntentNotPending);
        assert!(ctx.epoch() > intent.expires_at_epoch, EIntentNotExpired);
        intent.status = STATUS_EXPIRED;
        event::emit(IntentExpired { intent_id: object::id(intent) });
    }

    // === Liquidity Intent Functions ===

    public fun create_liquidity_intent(
        config: &ProtocolConfig,
        guard: &mut GuardRail,
        pool_id: ID,
        coin_type_a: String,
        coin_type_b: String,
        amount_a: u64,
        amount_b: u64,
        min_lp_out: u64,
        action: u8,
        ttl_epochs: u64,
        ctx: &mut TxContext,
    ): LiquidityIntent {
        core::assert_not_paused(config);

        let total_value = amount_a + amount_b;
        guard::validate_trade(
            guard,
            total_value,
            0, // no slippage check at intent creation
            &std::string::utf8(b"lp"),
            &coin_type_a,
            ctx,
        );

        let intent = LiquidityIntent {
            id: object::new(ctx),
            agent: ctx.sender(),
            user: guard::owner(guard),
            guard_rail_id: object::id(guard),
            pool_id,
            coin_type_a,
            coin_type_b,
            amount_a,
            amount_b,
            min_lp_out,
            action,
            created_at_epoch: ctx.epoch(),
            expires_at_epoch: ctx.epoch() + ttl_epochs,
            status: STATUS_PENDING,
        };

        event::emit(LiquidityIntentCreated {
            intent_id: object::id(&intent),
            agent: ctx.sender(),
            action,
            amount_a,
            amount_b,
        });

        intent
    }

    public fun execute_liquidity(
        intent: &mut LiquidityIntent,
        config: &mut ProtocolConfig,
        lp_amount: u64,
        ctx: &TxContext,
    ) {
        assert!(intent.status == STATUS_PENDING, EIntentNotPending);
        assert!(ctx.epoch() <= intent.expires_at_epoch, EIntentExpired);
        assert!(lp_amount >= intent.min_lp_out, EMinAmountNotMet);

        intent.status = STATUS_EXECUTED;
        core::record_intent_execution(config, intent.amount_a + intent.amount_b);

        event::emit(LiquidityExecuted {
            intent_id: object::id(intent),
            action: intent.action,
            lp_amount,
        });
    }

    public fun cancel_liquidity(intent: &mut LiquidityIntent, ctx: &TxContext) {
        assert!(intent.status == STATUS_PENDING, EIntentNotPending);
        assert!(
            ctx.sender() == intent.agent || ctx.sender() == intent.user,
            ENotIntentOwner,
        );
        intent.status = STATUS_CANCELLED;
        event::emit(IntentCancelled { intent_id: object::id(intent) });
    }

    // === Accessors ===

    public fun swap_status(intent: &SwapIntent): u8 { intent.status }
    public fun swap_amount_in(intent: &SwapIntent): u64 { intent.amount_in }
    public fun swap_min_out(intent: &SwapIntent): u64 { intent.min_amount_out }
    public fun swap_agent(intent: &SwapIntent): address { intent.agent }
    public fun swap_user(intent: &SwapIntent): address { intent.user }

    public fun liq_status(intent: &LiquidityIntent): u8 { intent.status }
    public fun liq_action(intent: &LiquidityIntent): u8 { intent.action }

    public fun status_pending(): u8 { STATUS_PENDING }
    public fun status_executed(): u8 { STATUS_EXECUTED }
    public fun status_failed(): u8 { STATUS_FAILED }
    public fun status_expired(): u8 { STATUS_EXPIRED }
    public fun status_cancelled(): u8 { STATUS_CANCELLED }
}

module suipilot::guard {
    use std::string::String;
    use sui::event;

    // === Errors ===

    const EUnauthorized: u64 = 0;
    const EAgentRevoked: u64 = 1;
    const ENotOwner: u64 = 2;
    const ESlippageExceeded: u64 = 200;
    const ESpendingLimitExceeded: u64 = 201;
    const EProtocolNotAllowed: u64 = 202;
    const ECoinTypeNotAllowed: u64 = 203;
    const EInvalidGuardConfig: u64 = 204;
    const ESingleTradeLimitExceeded: u64 = 205;
    const EGuardNotActive: u64 = 206;

    // === Structs ===

    public struct GuardRail has key, store {
        id: UID,
        owner: address,
        max_slippage_bps: u64,
        max_single_trade: u64,
        epoch_spending_limit: u64,
        epoch_spent: u64,
        last_epoch: u64,
        allowed_protocols: vector<String>,
        allowed_coin_types: vector<String>,
        agent: address,
        active: bool,
    }

    public struct AgentCap has key, store {
        id: UID,
        guard_rail_id: ID,
        agent: address,
        granted_at_epoch: u64,
    }

    // === Events ===

    public struct GuardRailCreated has copy, drop {
        guard_rail_id: ID,
        owner: address,
        agent: address,
        max_slippage_bps: u64,
        max_single_trade: u64,
        epoch_spending_limit: u64,
    }

    public struct AgentCapGranted has copy, drop {
        guard_rail_id: ID,
        agent: address,
        epoch: u64,
    }

    public struct AgentRevoked has copy, drop {
        guard_rail_id: ID,
    }

    public struct TradeValidated has copy, drop {
        guard_rail_id: ID,
        amount: u64,
        epoch_spent_after: u64,
    }

    public struct GuardUpdated has copy, drop {
        guard_rail_id: ID,
    }

    // === Public Functions ===

    public fun create_guard_rail(
        max_slippage_bps: u64,
        max_single_trade: u64,
        epoch_spending_limit: u64,
        allowed_protocols: vector<String>,
        allowed_coin_types: vector<String>,
        agent: address,
        ctx: &mut TxContext,
    ): GuardRail {
        assert!(max_slippage_bps > 0 && max_slippage_bps <= 10_000, EInvalidGuardConfig);
        assert!(max_single_trade > 0, EInvalidGuardConfig);
        assert!(epoch_spending_limit > 0, EInvalidGuardConfig);

        let guard = GuardRail {
            id: object::new(ctx),
            owner: ctx.sender(),
            max_slippage_bps,
            max_single_trade,
            epoch_spending_limit,
            epoch_spent: 0,
            last_epoch: ctx.epoch(),
            allowed_protocols,
            allowed_coin_types,
            agent,
            active: true,
        };

        event::emit(GuardRailCreated {
            guard_rail_id: object::id(&guard),
            owner: ctx.sender(),
            agent,
            max_slippage_bps,
            max_single_trade,
            epoch_spending_limit,
        });

        guard
    }

    /// Owner creates and keeps the GuardRail, agent gets the AgentCap
    public fun grant_agent_cap(
        guard: &mut GuardRail,
        ctx: &mut TxContext,
    ): AgentCap {
        assert!(ctx.sender() == guard.owner, ENotOwner);
        assert!(guard.active, EGuardNotActive);

        let cap = AgentCap {
            id: object::new(ctx),
            guard_rail_id: object::id(guard),
            agent: guard.agent,
            granted_at_epoch: ctx.epoch(),
        };

        event::emit(AgentCapGranted {
            guard_rail_id: object::id(guard),
            agent: guard.agent,
            epoch: ctx.epoch(),
        });

        cap
    }

    /// Owner revokes agent access
    public fun revoke_agent(guard: &mut GuardRail, ctx: &TxContext) {
        assert!(ctx.sender() == guard.owner, ENotOwner);
        guard.active = false;
        event::emit(AgentRevoked { guard_rail_id: object::id(guard) });
    }

    /// Reactivate guard rail with a new agent
    public fun reactivate(
        guard: &mut GuardRail,
        new_agent: address,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == guard.owner, ENotOwner);
        guard.agent = new_agent;
        guard.active = true;
        guard.epoch_spent = 0;
        guard.last_epoch = ctx.epoch();
    }

    /// Validate a trade against all guard rail constraints
    /// Updates epoch spending tracker. Aborts on any violation.
    public fun validate_trade(
        guard: &mut GuardRail,
        amount: u64,
        slippage_bps: u64,
        protocol: &String,
        coin_type: &String,
        ctx: &TxContext,
    ) {
        // Must be active
        assert!(guard.active, EGuardNotActive);

        // Must be the authorized agent
        assert!(ctx.sender() == guard.agent, EUnauthorized);

        // Slippage check
        assert!(slippage_bps <= guard.max_slippage_bps, ESlippageExceeded);

        // Single trade size check
        assert!(amount <= guard.max_single_trade, ESingleTradeLimitExceeded);

        // Protocol whitelist check
        assert!(is_in_list(&guard.allowed_protocols, protocol), EProtocolNotAllowed);

        // Coin type whitelist check (empty = allow all)
        if (!guard.allowed_coin_types.is_empty()) {
            assert!(is_in_list(&guard.allowed_coin_types, coin_type), ECoinTypeNotAllowed);
        };

        // Epoch spending limit check — reset if new epoch
        let current_epoch = ctx.epoch();
        if (current_epoch > guard.last_epoch) {
            guard.epoch_spent = 0;
            guard.last_epoch = current_epoch;
        };

        assert!(
            guard.epoch_spent + amount <= guard.epoch_spending_limit,
            ESpendingLimitExceeded,
        );

        // Update spending
        guard.epoch_spent = guard.epoch_spent + amount;

        event::emit(TradeValidated {
            guard_rail_id: object::id(guard),
            amount,
            epoch_spent_after: guard.epoch_spent,
        });
    }

    /// Owner updates guard rail limits
    public fun update_limits(
        guard: &mut GuardRail,
        max_slippage_bps: u64,
        max_single_trade: u64,
        epoch_spending_limit: u64,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == guard.owner, ENotOwner);
        assert!(max_slippage_bps > 0 && max_slippage_bps <= 10_000, EInvalidGuardConfig);

        guard.max_slippage_bps = max_slippage_bps;
        guard.max_single_trade = max_single_trade;
        guard.epoch_spending_limit = epoch_spending_limit;

        event::emit(GuardUpdated { guard_rail_id: object::id(guard) });
    }

    /// Owner updates allowed protocols
    public fun update_allowed_protocols(
        guard: &mut GuardRail,
        protocols: vector<String>,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == guard.owner, ENotOwner);
        guard.allowed_protocols = protocols;
        event::emit(GuardUpdated { guard_rail_id: object::id(guard) });
    }

    /// Owner updates allowed coin types
    public fun update_allowed_coins(
        guard: &mut GuardRail,
        coin_types: vector<String>,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == guard.owner, ENotOwner);
        guard.allowed_coin_types = coin_types;
        event::emit(GuardUpdated { guard_rail_id: object::id(guard) });
    }

    // === Accessors ===

    public fun owner(guard: &GuardRail): address { guard.owner }
    public fun agent(guard: &GuardRail): address { guard.agent }
    public fun is_active(guard: &GuardRail): bool { guard.active }
    public fun max_slippage(guard: &GuardRail): u64 { guard.max_slippage_bps }
    public fun max_single_trade(guard: &GuardRail): u64 { guard.max_single_trade }
    public fun epoch_spending_limit(guard: &GuardRail): u64 { guard.epoch_spending_limit }
    public fun epoch_spent(guard: &GuardRail): u64 { guard.epoch_spent }
    public fun guard_rail_id(cap: &AgentCap): ID { cap.guard_rail_id }

    // === Internal ===

    fun is_in_list(list: &vector<String>, target: &String): bool {
        let len = list.length();
        let mut i = 0;
        while (i < len) {
            if (&list[i] == target) return true;
            i = i + 1;
        };
        false
    }
}

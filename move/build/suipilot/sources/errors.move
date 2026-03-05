module suipilot::errors {

    // === Authorization ===
    const EUnauthorized: u64 = 0;
    const EAgentRevoked: u64 = 1;
    const ENotOwner: u64 = 2;
    const ENotAgent: u64 = 3;

    // === Intent ===
    const EInvalidIntent: u64 = 100;
    const EIntentExpired: u64 = 101;
    const EIntentAlreadyExecuted: u64 = 102;
    const EIntentNotPending: u64 = 103;

    // === Guard Rails ===
    const ESlippageExceeded: u64 = 200;
    const ESpendingLimitExceeded: u64 = 201;
    const EProtocolNotAllowed: u64 = 202;
    const ECoinTypeNotAllowed: u64 = 203;
    const EInvalidGuardConfig: u64 = 204;
    const ESingleTradeLimitExceeded: u64 = 205;

    // === Vault ===
    const EVaultPaused: u64 = 300;
    const EInsufficientBalance: u64 = 301;
    const EVaultCapExceeded: u64 = 302;
    const EZeroAmount: u64 = 303;
    const EZeroShares: u64 = 304;
    const EInvalidStrategy: u64 = 305;
    const ESharesExceedBalance: u64 = 306;

    // === Protocol ===
    const EProtocolPaused: u64 = 400;
    const EInvalidFee: u64 = 401;
    const EVersionMismatch: u64 = 402;

    // === Accessors (public for cross-module use) ===

    public fun unauthorized(): u64 { EUnauthorized }
    public fun agent_revoked(): u64 { EAgentRevoked }
    public fun not_owner(): u64 { ENotOwner }
    public fun not_agent(): u64 { ENotAgent }
    public fun invalid_intent(): u64 { EInvalidIntent }
    public fun intent_expired(): u64 { EIntentExpired }
    public fun intent_already_executed(): u64 { EIntentAlreadyExecuted }
    public fun intent_not_pending(): u64 { EIntentNotPending }
    public fun slippage_exceeded(): u64 { ESlippageExceeded }
    public fun spending_limit_exceeded(): u64 { ESpendingLimitExceeded }
    public fun protocol_not_allowed(): u64 { EProtocolNotAllowed }
    public fun coin_type_not_allowed(): u64 { ECoinTypeNotAllowed }
    public fun invalid_guard_config(): u64 { EInvalidGuardConfig }
    public fun single_trade_limit_exceeded(): u64 { ESingleTradeLimitExceeded }
    public fun vault_paused(): u64 { EVaultPaused }
    public fun insufficient_balance(): u64 { EInsufficientBalance }
    public fun vault_cap_exceeded(): u64 { EVaultCapExceeded }
    public fun zero_amount(): u64 { EZeroAmount }
    public fun zero_shares(): u64 { EZeroShares }
    public fun invalid_strategy(): u64 { EInvalidStrategy }
    public fun shares_exceed_balance(): u64 { ESharesExceedBalance }
    public fun protocol_paused(): u64 { EProtocolPaused }
    public fun invalid_fee(): u64 { EInvalidFee }
    public fun version_mismatch(): u64 { EVersionMismatch }
}

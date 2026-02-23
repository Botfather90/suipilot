module suipilot::logger {
    use std::string::String;
    use sui::event;

    // === Structs ===

    public struct ExecutionLog has key, store {
        id: UID,
        agent: address,
        user: address,
        intent_id: ID,
        action_type: String,
        protocol: String,
        amount_in: u64,
        amount_out: u64,
        fee_paid: u64,
        price_impact_bps: u64,
        epoch: u64,
        success: bool,
    }

    // === Events ===

    public struct ExecutionLogged has copy, drop {
        log_id: ID,
        agent: address,
        user: address,
        intent_id: ID,
        action_type: String,
        protocol: String,
        amount_in: u64,
        amount_out: u64,
        fee_paid: u64,
        price_impact_bps: u64,
        epoch: u64,
        success: bool,
    }

    // === Functions ===

    /// Create an execution log and transfer it to the user for permanent record
    public fun log_execution(
        agent: address,
        user: address,
        intent_id: ID,
        action_type: String,
        protocol: String,
        amount_in: u64,
        amount_out: u64,
        fee_paid: u64,
        price_impact_bps: u64,
        success: bool,
        ctx: &mut TxContext,
    ) {
        let log = ExecutionLog {
            id: object::new(ctx),
            agent,
            user,
            intent_id,
            action_type,
            protocol,
            amount_in,
            amount_out,
            fee_paid,
            price_impact_bps,
            epoch: ctx.epoch(),
            success,
        };

        let log_id = object::id(&log);

        event::emit(ExecutionLogged {
            log_id,
            agent,
            user,
            intent_id,
            action_type: log.action_type,
            protocol: log.protocol,
            amount_in,
            amount_out,
            fee_paid,
            price_impact_bps,
            epoch: log.epoch,
            success,
        });

        // Transfer log to user so they own their audit trail
        transfer::transfer(log, user);
    }

    // === Accessors ===

    public fun log_agent(log: &ExecutionLog): address { log.agent }
    public fun log_user(log: &ExecutionLog): address { log.user }
    public fun log_intent_id(log: &ExecutionLog): ID { log.intent_id }
    public fun log_action(log: &ExecutionLog): &String { &log.action_type }
    public fun log_protocol(log: &ExecutionLog): &String { &log.protocol }
    public fun log_amount_in(log: &ExecutionLog): u64 { log.amount_in }
    public fun log_amount_out(log: &ExecutionLog): u64 { log.amount_out }
    public fun log_fee(log: &ExecutionLog): u64 { log.fee_paid }
    public fun log_impact(log: &ExecutionLog): u64 { log.price_impact_bps }
    public fun log_epoch(log: &ExecutionLog): u64 { log.epoch }
    public fun log_success(log: &ExecutionLog): bool { log.success }
}

module suipilot::core {
    use std::string::String;
    use sui::event;

    // === Errors ===

    const EUnauthorized: u64 = 0;
    const EProtocolPaused: u64 = 400;
    const EInvalidFee: u64 = 401;
    const EProtocolAlreadyListed: u64 = 402;
    const EProtocolNotFound: u64 = 403;

    // === Constants ===

    const VERSION: u64 = 1;
    const MAX_FEE_BPS: u64 = 500; // 5% max protocol fee

    // === Structs ===

    public struct CORE has drop {}

    public struct ProtocolConfig has key {
        id: UID,
        version: u64,
        paused: bool,
        fee_bps: u64,
        treasury: address,
        supported_protocols: vector<String>,
        total_intents_executed: u64,
        total_volume: u128,
    }

    public struct AdminCap has key, store {
        id: UID,
    }

    // === Events ===

    public struct ProtocolPaused has copy, drop {
        paused: bool,
    }

    public struct FeeUpdated has copy, drop {
        old_fee_bps: u64,
        new_fee_bps: u64,
    }

    public struct TreasuryUpdated has copy, drop {
        old_treasury: address,
        new_treasury: address,
    }

    public struct ProtocolAdded has copy, drop {
        protocol: String,
    }

    public struct ProtocolRemoved has copy, drop {
        protocol: String,
    }

    public struct IntentRecorded has copy, drop {
        total_intents: u64,
        volume_added: u64,
        total_volume: u128,
    }

    // === Init ===

    fun init(_otw: CORE, ctx: &mut TxContext) {
        let config = ProtocolConfig {
            id: object::new(ctx),
            version: VERSION,
            paused: false,
            fee_bps: 10, // 0.1% default
            treasury: ctx.sender(),
            supported_protocols: vector::empty(),
            total_intents_executed: 0,
            total_volume: 0,
        };
        transfer::share_object(config);

        let admin = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin, ctx.sender());
    }

    // === Admin Functions ===

    public fun pause(config: &mut ProtocolConfig, _admin: &AdminCap) {
        config.paused = true;
        event::emit(ProtocolPaused { paused: true });
    }

    public fun unpause(config: &mut ProtocolConfig, _admin: &AdminCap) {
        config.paused = false;
        event::emit(ProtocolPaused { paused: false });
    }

    public fun update_fee(
        config: &mut ProtocolConfig,
        _admin: &AdminCap,
        new_fee_bps: u64,
    ) {
        assert!(new_fee_bps <= MAX_FEE_BPS, EInvalidFee);
        let old = config.fee_bps;
        config.fee_bps = new_fee_bps;
        event::emit(FeeUpdated { old_fee_bps: old, new_fee_bps });
    }

    public fun update_treasury(
        config: &mut ProtocolConfig,
        _admin: &AdminCap,
        new_treasury: address,
    ) {
        let old = config.treasury;
        config.treasury = new_treasury;
        event::emit(TreasuryUpdated { old_treasury: old, new_treasury });
    }

    public fun add_protocol(
        config: &mut ProtocolConfig,
        _admin: &AdminCap,
        protocol: String,
    ) {
        let (found, _) = find_protocol(&config.supported_protocols, &protocol);
        assert!(!found, EProtocolAlreadyListed);
        config.supported_protocols.push_back(protocol);
        event::emit(ProtocolAdded { protocol });
    }

    public fun remove_protocol(
        config: &mut ProtocolConfig,
        _admin: &AdminCap,
        protocol: String,
    ) {
        let (found, idx) = find_protocol(&config.supported_protocols, &protocol);
        assert!(found, EProtocolNotFound);
        config.supported_protocols.swap_remove(idx);
        event::emit(ProtocolRemoved { protocol });
    }

    // === Public Accessors ===

    public fun is_paused(config: &ProtocolConfig): bool { config.paused }
    public fun fee_bps(config: &ProtocolConfig): u64 { config.fee_bps }
    public fun treasury(config: &ProtocolConfig): address { config.treasury }
    public fun version(config: &ProtocolConfig): u64 { config.version }
    public fun total_intents(config: &ProtocolConfig): u64 { config.total_intents_executed }
    public fun total_volume(config: &ProtocolConfig): u128 { config.total_volume }

    public fun is_protocol_supported(config: &ProtocolConfig, protocol: &String): bool {
        let (found, _) = find_protocol(&config.supported_protocols, protocol);
        found
    }

    // === Package Functions ===

    /// Called by intent module after successful execution
    public(package) fun record_intent_execution(
        config: &mut ProtocolConfig,
        volume: u64,
    ) {
        config.total_intents_executed = config.total_intents_executed + 1;
        config.total_volume = config.total_volume + (volume as u128);
        event::emit(IntentRecorded {
            total_intents: config.total_intents_executed,
            volume_added: volume,
            total_volume: config.total_volume,
        });
    }

    public(package) fun assert_not_paused(config: &ProtocolConfig) {
        assert!(!config.paused, EProtocolPaused);
    }

    // === Internal ===

    fun find_protocol(protocols: &vector<String>, target: &String): (bool, u64) {
        let len = protocols.length();
        let mut i = 0;
        while (i < len) {
            if (&protocols[i] == target) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }
}

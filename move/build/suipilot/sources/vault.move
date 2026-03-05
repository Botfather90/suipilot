module suipilot::vault {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use suipilot::math;

    // === Errors ===

    const EVaultPaused: u64 = 300;
    const EZeroAmount: u64 = 303;
    const EZeroShares: u64 = 304;
    const EInvalidStrategy: u64 = 305;
    const ENotVaultAdmin: u64 = 306;
    const EInvalidFees: u64 = 307;
    const EWrongVault: u64 = 308;

    // === Constants ===

    const BPS_BASE: u64 = 10_000;
    const MAX_PERFORMANCE_FEE: u64 = 3_000; // 30%
    const MAX_MANAGEMENT_FEE: u64 = 500;    // 5%

    // === Structs ===

    public struct VaultStrategy has store, copy, drop {
        target_alloc_lp: u64,
        target_alloc_stake: u64,
        target_alloc_lend: u64,
        target_alloc_idle: u64,
        rebalance_threshold: u64,
        max_single_alloc: u64,
    }

    public struct Vault<phantom CoinType> has key {
        id: UID,
        balance: Balance<CoinType>,
        total_shares: u64,
        strategy: VaultStrategy,
        paused: bool,
        total_deposited: u128,
        total_withdrawn: u128,
        total_yield: u128,
        performance_fee_bps: u64,
        management_fee_bps: u64,
        last_harvest_epoch: u64,
        fee_balance: Balance<CoinType>,
    }

    public struct VaultShare<phantom CoinType> has key, store {
        id: UID,
        vault_id: ID,
        shares: u64,
        deposited_at_epoch: u64,
        deposit_amount: u64,
    }

    public struct VaultAdminCap<phantom CoinType> has key, store {
        id: UID,
        vault_id: ID,
    }

    // === Events ===

    public struct VaultCreated has copy, drop {
        vault_id: ID,
        performance_fee_bps: u64,
        management_fee_bps: u64,
    }

    public struct Deposited has copy, drop {
        vault_id: ID,
        user: address,
        amount: u64,
        shares_minted: u64,
        total_shares: u64,
        total_balance: u64,
    }

    public struct Withdrawn has copy, drop {
        vault_id: ID,
        user: address,
        shares_burned: u64,
        amount_returned: u64,
        total_shares: u64,
        total_balance: u64,
    }

    public struct Harvested has copy, drop {
        vault_id: ID,
        yield_amount: u64,
        fee_taken: u64,
        new_total_balance: u64,
        epoch: u64,
    }

    public struct StrategyUpdated has copy, drop {
        vault_id: ID,
    }

    public struct VaultPauseToggled has copy, drop {
        vault_id: ID,
        paused: bool,
    }

    // === Create ===

    public fun create_vault<CoinType>(
        strategy: VaultStrategy,
        performance_fee_bps: u64,
        management_fee_bps: u64,
        ctx: &mut TxContext,
    ): VaultAdminCap<CoinType> {
        validate_strategy(&strategy);
        assert!(performance_fee_bps <= MAX_PERFORMANCE_FEE, EInvalidFees);
        assert!(management_fee_bps <= MAX_MANAGEMENT_FEE, EInvalidFees);

        let vault = Vault<CoinType> {
            id: object::new(ctx),
            balance: balance::zero(),
            total_shares: 0,
            strategy,
            paused: false,
            total_deposited: 0,
            total_withdrawn: 0,
            total_yield: 0,
            performance_fee_bps,
            management_fee_bps,
            last_harvest_epoch: ctx.epoch(),
            fee_balance: balance::zero(),
        };

        let vault_id = object::id(&vault);

        let admin_cap = VaultAdminCap<CoinType> {
            id: object::new(ctx),
            vault_id,
        };

        event::emit(VaultCreated {
            vault_id,
            performance_fee_bps,
            management_fee_bps,
        });

        transfer::share_object(vault);
        admin_cap
    }

    public fun new_strategy(
        lp: u64,
        stake: u64,
        lend: u64,
        idle: u64,
        rebalance_threshold: u64,
        max_single_alloc: u64,
    ): VaultStrategy {
        let s = VaultStrategy {
            target_alloc_lp: lp,
            target_alloc_stake: stake,
            target_alloc_lend: lend,
            target_alloc_idle: idle,
            rebalance_threshold,
            max_single_alloc,
        };
        validate_strategy(&s);
        s
    }

    // === Deposit ===

    public fun deposit<CoinType>(
        vault: &mut Vault<CoinType>,
        coin: Coin<CoinType>,
        ctx: &mut TxContext,
    ): VaultShare<CoinType> {
        assert!(!vault.paused, EVaultPaused);

        let amount = coin.value();
        assert!(amount > 0, EZeroAmount);

        let total_balance = vault.balance.value();
        let shares_to_mint = math::calculate_shares_to_mint(
            amount,
            total_balance,
            vault.total_shares,
        );
        assert!(shares_to_mint > 0, EZeroShares);

        // Add coins to vault
        vault.balance.join(coin.into_balance());
        vault.total_shares = vault.total_shares + shares_to_mint;
        vault.total_deposited = vault.total_deposited + (amount as u128);

        let share = VaultShare<CoinType> {
            id: object::new(ctx),
            vault_id: object::id(vault),
            shares: shares_to_mint,
            deposited_at_epoch: ctx.epoch(),
            deposit_amount: amount,
        };

        event::emit(Deposited {
            vault_id: object::id(vault),
            user: ctx.sender(),
            amount,
            shares_minted: shares_to_mint,
            total_shares: vault.total_shares,
            total_balance: vault.balance.value(),
        });

        share
    }

    // === Withdraw ===

    public fun withdraw<CoinType>(
        vault: &mut Vault<CoinType>,
        share: VaultShare<CoinType>,
        ctx: &mut TxContext,
    ): Coin<CoinType> {
        assert!(!vault.paused, EVaultPaused);
        assert!(share.vault_id == object::id(vault), EWrongVault);
        assert!(share.shares > 0, EZeroShares);

        let shares_burned = share.shares;
        let total_balance = vault.balance.value();
        let coins_to_return = math::calculate_withdrawal_amount(
            shares_burned,
            total_balance,
            vault.total_shares,
        );

        // Burn shares
        vault.total_shares = vault.total_shares - shares_burned;
        vault.total_withdrawn = vault.total_withdrawn + (coins_to_return as u128);

        let VaultShare { id, vault_id: _, shares: _, deposited_at_epoch: _, deposit_amount: _ } = share;
        object::delete(id);

        let withdrawn_balance = vault.balance.split(coins_to_return);

        event::emit(Withdrawn {
            vault_id: object::id(vault),
            user: ctx.sender(),
            shares_burned,
            amount_returned: coins_to_return,
            total_shares: vault.total_shares,
            total_balance: vault.balance.value(),
        });

        coin::from_balance(withdrawn_balance, ctx)
    }

    // === Harvest (Admin adds yield) ===

    /// Admin deposits profit/yield into the vault, taking performance fee
    public fun harvest<CoinType>(
        vault: &mut Vault<CoinType>,
        admin_cap: &VaultAdminCap<CoinType>,
        profit: Coin<CoinType>,
        ctx: &mut TxContext,
    ) {
        assert!(admin_cap.vault_id == object::id(vault), ENotVaultAdmin);

        let profit_amount = profit.value();
        assert!(profit_amount > 0, EZeroAmount);

        let mut profit_balance = profit.into_balance();

        // Take performance fee
        let fee_amount = math::calculate_fee(profit_amount, vault.performance_fee_bps);
        if (fee_amount > 0 && fee_amount < profit_amount) {
            let fee = profit_balance.split(fee_amount);
            vault.fee_balance.join(fee);
        };

        // Add remaining profit to vault (increases share price for all holders)
        vault.balance.join(profit_balance);
        vault.total_yield = vault.total_yield + (profit_amount as u128);
        vault.last_harvest_epoch = ctx.epoch();

        event::emit(Harvested {
            vault_id: object::id(vault),
            yield_amount: profit_amount,
            fee_taken: fee_amount,
            new_total_balance: vault.balance.value(),
            epoch: ctx.epoch(),
        });
    }

    /// Admin collects accumulated fees
    public fun collect_fees<CoinType>(
        vault: &mut Vault<CoinType>,
        admin_cap: &VaultAdminCap<CoinType>,
        ctx: &mut TxContext,
    ): Coin<CoinType> {
        assert!(admin_cap.vault_id == object::id(vault), ENotVaultAdmin);
        let fee_amount = vault.fee_balance.value();
        let fee = vault.fee_balance.split(fee_amount);
        coin::from_balance(fee, ctx)
    }

    // === Admin Functions ===

    public fun update_strategy<CoinType>(
        vault: &mut Vault<CoinType>,
        admin_cap: &VaultAdminCap<CoinType>,
        new_strategy: VaultStrategy,
    ) {
        assert!(admin_cap.vault_id == object::id(vault), ENotVaultAdmin);
        validate_strategy(&new_strategy);
        vault.strategy = new_strategy;
        event::emit(StrategyUpdated { vault_id: object::id(vault) });
    }

    public fun pause_vault<CoinType>(
        vault: &mut Vault<CoinType>,
        admin_cap: &VaultAdminCap<CoinType>,
    ) {
        assert!(admin_cap.vault_id == object::id(vault), ENotVaultAdmin);
        vault.paused = true;
        event::emit(VaultPauseToggled { vault_id: object::id(vault), paused: true });
    }

    public fun unpause_vault<CoinType>(
        vault: &mut Vault<CoinType>,
        admin_cap: &VaultAdminCap<CoinType>,
    ) {
        assert!(admin_cap.vault_id == object::id(vault), ENotVaultAdmin);
        vault.paused = false;
        event::emit(VaultPauseToggled { vault_id: object::id(vault), paused: false });
    }

    // === Accessors ===

    public fun vault_balance<CoinType>(vault: &Vault<CoinType>): u64 {
        vault.balance.value()
    }

    public fun vault_total_shares<CoinType>(vault: &Vault<CoinType>): u64 {
        vault.total_shares
    }

    public fun vault_is_paused<CoinType>(vault: &Vault<CoinType>): bool {
        vault.paused
    }

    public fun vault_strategy<CoinType>(vault: &Vault<CoinType>): VaultStrategy {
        vault.strategy
    }

    public fun share_value<CoinType>(vault: &Vault<CoinType>, shares: u64): u64 {
        if (vault.total_shares == 0) return 0;
        math::calculate_withdrawal_amount(shares, vault.balance.value(), vault.total_shares)
    }

    public fun share_amount<CoinType>(share: &VaultShare<CoinType>): u64 {
        share.shares
    }

    public fun vault_total_deposited<CoinType>(vault: &Vault<CoinType>): u128 {
        vault.total_deposited
    }

    public fun vault_total_yield<CoinType>(vault: &Vault<CoinType>): u128 {
        vault.total_yield
    }

    // === Internal ===

    fun validate_strategy(s: &VaultStrategy) {
        let total = s.target_alloc_lp + s.target_alloc_stake
            + s.target_alloc_lend + s.target_alloc_idle;
        assert!(total == BPS_BASE, EInvalidStrategy);
        assert!(s.rebalance_threshold > 0 && s.rebalance_threshold <= 2_000, EInvalidStrategy);
        assert!(s.max_single_alloc > 0 && s.max_single_alloc <= BPS_BASE, EInvalidStrategy);
    }
}

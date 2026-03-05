/// SuiPilot — Test Suite
///
/// Tests for core protocol flows:
///   - Guard rail creation, trade validation, and access control
///   - Vault deposit / withdraw share accounting
///   - Math library correctness
///
/// Run with: sui move test
#[test_only]
module suipilot::tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use sui::sui::SUI;
    use suipilot::guard::{Self, GuardRail};
    use suipilot::vault::{Self, Vault, VaultShare, VaultAdminCap, VaultStrategy};
    use suipilot::math;

    // === Test Addresses ===

    const USER:     address = @0xA0;
    const AGENT:    address = @0xA6;
    const ATTACKER: address = @0xBA;

    // =========================================================
    // === Math Tests ==========================================
    // =========================================================

    #[test]
    fun test_math_mul_div_basic() {
        assert!(math::mul_div(100, 50, 100) == 50, 0);
        assert!(math::mul_div(1_000_000_000, 100, 10_000) == 10_000_000, 1);
        assert!(math::mul_div(7, 3, 5) == 4, 2);           // rounds down: 4.2 → 4
    }

    #[test]
    fun test_math_mul_div_up_basic() {
        assert!(math::mul_div_up(7, 3, 5) == 5, 0);        // rounds up: 4.2 → 5
        assert!(math::mul_div_up(10, 10, 5) == 20, 1);     // exact, no rounding
        assert!(math::mul_div_up(11, 3, 10) == 4, 2);      // 3.3 → 4
    }

    #[test]
    fun test_math_sqrt_values() {
        assert!(math::sqrt(0) == 0, 0);
        assert!(math::sqrt(1) == 1, 1);
        assert!(math::sqrt(4) == 2, 2);
        assert!(math::sqrt(9) == 3, 3);
        assert!(math::sqrt(100) == 10, 4);
        assert!(math::sqrt(10_000) == 100, 5);
        assert!(math::sqrt(2) == 1, 6);     // floor(sqrt(2)) = 1
        assert!(math::sqrt(15) == 3, 7);    // floor(sqrt(15)) = 3
    }

    #[test]
    fun test_math_shares_to_mint_first_deposit() {
        // First deposit: total_shares = 0, total_balance = 0 → shares = deposit_amount
        assert!(math::calculate_shares_to_mint(1_000_000_000, 0, 0) == 1_000_000_000, 0);
    }

    #[test]
    fun test_math_shares_to_mint_proportional() {
        // Second deposit into pool with 1B shares / 1B balance: same ratio → 500M shares
        assert!(math::calculate_shares_to_mint(500_000_000, 1_000_000_000, 1_000_000_000) == 500_000_000, 0);
    }

    #[test]
    fun test_math_shares_to_mint_after_yield() {
        // Pool has 1B shares, 1.5B balance (yield earned).
        // Depositing 500M should get fewer shares than 500M (share price rose).
        let shares = math::calculate_shares_to_mint(500_000_000, 1_500_000_000, 1_000_000_000);
        assert!(shares == 333_333_333, 0);
    }

    #[test]
    fun test_math_withdrawal_amount_proportional() {
        // 500M shares out of 1B total shares, 1B balance → returns 500M
        assert!(math::calculate_withdrawal_amount(500_000_000, 1_000_000_000, 1_000_000_000) == 500_000_000, 0);
        // All shares → returns full balance
        assert!(math::calculate_withdrawal_amount(1_000_000_000, 1_500_000_000, 1_000_000_000) == 1_500_000_000, 1);
    }

    #[test]
    fun test_math_swap_output() {
        // 1000 / 1000 reserves, swap 100 in, 0.3% fee → roughly 90
        let out = math::calculate_swap_output(1000, 1000, 100, 30);
        assert!(out > 85 && out < 95, 0);
    }

    #[test]
    fun test_math_slippage() {
        assert!(math::calculate_slippage(100, 100) == 0, 0);     // no slippage
        assert!(math::calculate_slippage(100, 99) == 100, 1);    // 1% = 100 bps
        assert!(math::calculate_slippage(100, 95) == 500, 2);    // 5% = 500 bps
        assert!(math::calculate_slippage(100, 105) == 0, 3);     // better than expected → 0
    }

    #[test]
    #[expected_failure(abort_code = 0)]  // EDivisionByZero
    fun test_math_div_by_zero_aborts() {
        math::mul_div(100, 50, 0);
    }

    // =========================================================
    // === Guard Rail Tests =====================================
    // =========================================================

    #[test]
    fun test_guard_rail_creation() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                100,            // max_slippage_bps = 1%
                1_000_000_000,  // max_single_trade = 1 SUI
                5_000_000_000,  // epoch_spending_limit = 5 SUI
                vector[string::utf8(b"cetus"), string::utf8(b"turbos")],
                vector[string::utf8(b"0x2::sui::SUI")],
                AGENT,
                ts::ctx(&mut scenario),
            );

            assert!(guard::owner(&guard) == USER, 0);
            assert!(guard::agent(&guard) == AGENT, 1);
            assert!(guard::is_active(&guard), 2);
            assert!(guard::max_slippage(&guard) == 100, 3);
            assert!(guard::max_single_trade(&guard) == 1_000_000_000, 4);
            assert!(guard::epoch_spending_limit(&guard) == 5_000_000_000, 5);
            assert!(guard::epoch_spent(&guard) == 0, 6);

            transfer::public_transfer(guard, USER);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_validate_trade_success() {
        let mut scenario = ts::begin(USER);

        // USER creates guard and shares it so AGENT can access
        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                200,            // 2% max slippage
                2_000_000_000,  // 2 SUI max single trade
                10_000_000_000, // 10 SUI epoch limit
                vector[string::utf8(b"cetus")],
                vector[],       // empty = all coins allowed
                AGENT,
                ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        // AGENT validates a trade within all limits
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);

            guard::validate_trade(
                &mut guard,
                1_000_000_000,  // 1 SUI — within 2 SUI single trade limit
                100,            // 1% slippage — within 2% limit
                &string::utf8(b"cetus"),
                &string::utf8(b"0x2::sui::SUI"),
                ts::ctx(&mut scenario),
            );

            // Epoch spent should be updated
            assert!(guard::epoch_spent(&guard) == 1_000_000_000, 0);
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_validate_trade_epoch_spending_accumulates() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                500,
                2_000_000_000,
                10_000_000_000,
                vector[string::utf8(b"cetus")],
                vector[],
                AGENT,
                ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        // First trade: 1 SUI
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            guard::validate_trade(&mut guard, 1_000_000_000, 100, &string::utf8(b"cetus"), &string::utf8(b"0x2::sui::SUI"), ts::ctx(&mut scenario));
            assert!(guard::epoch_spent(&guard) == 1_000_000_000, 0);
            ts::return_shared(guard);
        };

        // Second trade: 2 SUI → total 3 SUI spent
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            guard::validate_trade(&mut guard, 2_000_000_000, 100, &string::utf8(b"cetus"), &string::utf8(b"0x2::sui::SUI"), ts::ctx(&mut scenario));
            assert!(guard::epoch_spent(&guard) == 3_000_000_000, 1);
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 200)] // ESlippageExceeded
    fun test_validate_trade_slippage_exceeded_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                100, 1_000_000_000, 5_000_000_000,
                vector[string::utf8(b"cetus")], vector[], AGENT,
                ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            // 200 bps slippage > 100 bps max → should abort ESlippageExceeded
            guard::validate_trade(&mut guard, 500_000_000, 200, &string::utf8(b"cetus"), &string::utf8(b"0x2::sui::SUI"), ts::ctx(&mut scenario));
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 205)] // ESingleTradeLimitExceeded
    fun test_validate_trade_single_trade_limit_exceeded_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                500, 500_000_000, 10_000_000_000, // max single trade = 0.5 SUI
                vector[string::utf8(b"cetus")], vector[], AGENT,
                ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            // Trading 1 SUI > 0.5 SUI limit → ESingleTradeLimitExceeded
            guard::validate_trade(&mut guard, 1_000_000_000, 100, &string::utf8(b"cetus"), &string::utf8(b"0x2::sui::SUI"), ts::ctx(&mut scenario));
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 201)] // ESpendingLimitExceeded
    fun test_validate_trade_epoch_limit_exceeded_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                500, 2_000_000_000,
                1_000_000_000, // epoch limit = 1 SUI
                vector[string::utf8(b"cetus")], vector[], AGENT,
                ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            // 1.5 SUI > 1 SUI epoch limit → ESpendingLimitExceeded
            guard::validate_trade(&mut guard, 1_500_000_000, 100, &string::utf8(b"cetus"), &string::utf8(b"0x2::sui::SUI"), ts::ctx(&mut scenario));
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 202)] // EProtocolNotAllowed
    fun test_validate_trade_protocol_not_allowed_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                500, 2_000_000_000, 10_000_000_000,
                vector[string::utf8(b"cetus")], // only cetus
                vector[], AGENT, ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            // turbos not in whitelist → EProtocolNotAllowed
            guard::validate_trade(&mut guard, 100_000_000, 100, &string::utf8(b"turbos"), &string::utf8(b"0x2::sui::SUI"), ts::ctx(&mut scenario));
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 203)] // ECoinTypeNotAllowed
    fun test_validate_trade_coin_type_not_allowed_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                500, 2_000_000_000, 10_000_000_000,
                vector[string::utf8(b"cetus")],
                vector[string::utf8(b"0x2::sui::SUI")], // only SUI allowed
                AGENT, ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            // USDC not in coin whitelist → ECoinTypeNotAllowed
            guard::validate_trade(&mut guard, 100_000_000, 100, &string::utf8(b"cetus"),
                &string::utf8(b"0x5d4b::coin::COIN"), ts::ctx(&mut scenario));
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 0)] // EUnauthorized — wrong agent
    fun test_validate_trade_unauthorized_caller_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                500, 2_000_000_000, 10_000_000_000,
                vector[string::utf8(b"cetus")], vector[], AGENT,
                ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        // ATTACKER (not AGENT) tries to call validate_trade
        ts::next_tx(&mut scenario, ATTACKER);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            guard::validate_trade(&mut guard, 100_000_000, 100, &string::utf8(b"cetus"), &string::utf8(b"0x2::sui::SUI"), ts::ctx(&mut scenario));
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_guard_rail_revoke_and_reactivate() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let mut guard = guard::create_guard_rail(
                100, 1_000_000_000, 5_000_000_000,
                vector[], vector[], AGENT, ts::ctx(&mut scenario),
            );

            assert!(guard::is_active(&guard), 0);

            guard::revoke_agent(&mut guard, ts::ctx(&mut scenario));
            assert!(!guard::is_active(&guard), 1);

            guard::reactivate(&mut guard, @0xcb2d75df0105cce9a9057a26f384ea40c39d16af2b24d76ce3de5d842ac809bc, ts::ctx(&mut scenario));
            assert!(guard::is_active(&guard), 2);
            assert!(guard::agent(&guard) == @0xcb2d75df0105cce9a9057a26f384ea40c39d16af2b24d76ce3de5d842ac809bc, 3);
            assert!(guard::epoch_spent(&guard) == 0, 4); // reset on reactivate

            transfer::public_transfer(guard, USER);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2)] // ENotOwner
    fun test_guard_rail_revoke_not_owner_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let guard = guard::create_guard_rail(
                100, 1_000_000_000, 5_000_000_000,
                vector[], vector[], AGENT, ts::ctx(&mut scenario),
            );
            transfer::share_object(guard);
        };

        ts::next_tx(&mut scenario, ATTACKER);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            // Attacker is not owner → ENotOwner
            guard::revoke_agent(&mut guard, ts::ctx(&mut scenario));
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 206)] // EGuardNotActive
    fun test_validate_trade_on_revoked_guard_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let mut guard = guard::create_guard_rail(
                100, 1_000_000_000, 5_000_000_000,
                vector[string::utf8(b"cetus")], vector[], AGENT,
                ts::ctx(&mut scenario),
            );
            guard::revoke_agent(&mut guard, ts::ctx(&mut scenario));
            transfer::share_object(guard);
        };

        ts::next_tx(&mut scenario, AGENT);
        {
            let mut guard = ts::take_shared<GuardRail>(&scenario);
            // Guard is revoked → EGuardNotActive
            guard::validate_trade(&mut guard, 100_000_000, 50, &string::utf8(b"cetus"), &string::utf8(b"0x2::sui::SUI"), ts::ctx(&mut scenario));
            ts::return_shared(guard);
        };

        ts::end(scenario);
    }

    // =========================================================
    // === Vault Tests ==========================================
    // =========================================================

    fun make_yield_strategy(): VaultStrategy {
        vault::new_strategy(0, 0, 9000, 1000, 500, 8000)
    }

    #[test]
    fun test_vault_first_deposit_mints_1_to_1_shares() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let strat = make_yield_strategy();
            let admin_cap = vault::create_vault<SUI>(strat, 1000, 100, ts::ctx(&mut scenario));
            transfer::public_transfer(admin_cap, USER);
        };

        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let deposit_coin = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));

            let share = vault::deposit(&mut vault, deposit_coin, ts::ctx(&mut scenario));

            // First deposit: shares == amount (1:1)
            assert!(vault::share_amount(&share) == 1_000_000_000, 0);
            assert!(vault::vault_balance(&vault) == 1_000_000_000, 1);
            assert!(vault::vault_total_shares(&vault) == 1_000_000_000, 2);

            transfer::public_transfer(share, USER);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_vault_withdraw_returns_full_deposit() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let strat = make_yield_strategy();
            let admin_cap = vault::create_vault<SUI>(strat, 1000, 100, ts::ctx(&mut scenario));
            transfer::public_transfer(admin_cap, USER);
        };

        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            let share = vault::deposit(&mut vault, coin, ts::ctx(&mut scenario));
            transfer::public_transfer(share, USER);
            ts::return_shared(vault);
        };

        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let share = ts::take_from_sender<VaultShare<SUI>>(&scenario);

            let out = vault::withdraw(&mut vault, share, ts::ctx(&mut scenario));

            // Full balance returned (no performance fee on withdrawal, only on harvest)
            assert!(coin::value(&out) == 1_000_000_000, 0);
            assert!(vault::vault_total_shares(&vault) == 0, 1);
            assert!(vault::vault_balance(&vault) == 0, 2);

            transfer::public_transfer(out, USER);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_vault_two_depositors_proportional_shares() {
        let user2: address = @0xB0;
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let strat = make_yield_strategy();
            let admin_cap = vault::create_vault<SUI>(strat, 1000, 100, ts::ctx(&mut scenario));
            transfer::public_transfer(admin_cap, USER);
        };

        // User1 deposits 1 SUI → gets 1B shares
        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            let share = vault::deposit(&mut vault, coin, ts::ctx(&mut scenario));
            assert!(vault::share_amount(&share) == 1_000_000_000, 0);
            transfer::public_transfer(share, USER);
            ts::return_shared(vault);
        };

        // User2 deposits 1 SUI → also gets 1B shares (same price, no yield yet)
        ts::next_tx(&mut scenario, user2);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            let share = vault::deposit(&mut vault, coin, ts::ctx(&mut scenario));
            assert!(vault::share_amount(&share) == 1_000_000_000, 1);
            assert!(vault::vault_total_shares(&vault) == 2_000_000_000, 2);
            assert!(vault::vault_balance(&vault) == 2_000_000_000, 3);
            transfer::public_transfer(share, user2);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_vault_share_price_rises_after_harvest() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let strat = make_yield_strategy();
            let admin_cap = vault::create_vault<SUI>(strat, 0, 0, ts::ctx(&mut scenario)); // 0% fees for simplicity
            transfer::public_transfer(admin_cap, USER);
        };

        // Deposit 1 SUI
        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            let share = vault::deposit(&mut vault, coin, ts::ctx(&mut scenario));
            assert!(vault::share_amount(&share) == 1_000_000_000, 0);
            transfer::public_transfer(share, USER);
            ts::return_shared(vault);
        };

        // Admin harvests 500M MIST (0.5 SUI) yield with 0% fee
        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let admin_cap = ts::take_from_sender<VaultAdminCap<SUI>>(&scenario);
            let profit = coin::mint_for_testing<SUI>(500_000_000, ts::ctx(&mut scenario));
            vault::harvest(&mut vault, &admin_cap, profit, ts::ctx(&mut scenario));
            // Balance is now 1.5 SUI, shares still 1B
            assert!(vault::vault_balance(&vault) == 1_500_000_000, 0);
            assert!(vault::vault_total_shares(&vault) == 1_000_000_000, 1);
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(vault);
        };

        // Now a new 1 SUI deposit should get fewer shares (share price rose)
        ts::next_tx(&mut scenario, @0xC0);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            let share = vault::deposit(&mut vault, coin, ts::ctx(&mut scenario));
            // 1B deposit / 1.5B balance * 1B shares = 666M shares
            assert!(vault::share_amount(&share) == 666_666_666, 0);
            transfer::public_transfer(share, @0xC0);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 300)] // EVaultPaused
    fun test_vault_deposit_while_paused_aborts() {
        let mut scenario = ts::begin(USER);

        ts::next_tx(&mut scenario, USER);
        {
            let strat = make_yield_strategy();
            let admin_cap = vault::create_vault<SUI>(strat, 1000, 100, ts::ctx(&mut scenario));
            transfer::public_transfer(admin_cap, USER);
        };

        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let admin_cap = ts::take_from_sender<VaultAdminCap<SUI>>(&scenario);
            vault::pause_vault(&mut vault, &admin_cap);
            assert!(vault::vault_is_paused(&vault), 0);
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(vault);
        };

        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            // Should abort: EVaultPaused
            let share = vault::deposit(&mut vault, coin, ts::ctx(&mut scenario));
            transfer::public_transfer(share, USER);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }
}

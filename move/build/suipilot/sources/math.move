module suipilot::math {

    // === Constants ===

    const BPS_BASE: u64 = 10_000;
    const U64_MAX: u64 = 18_446_744_073_709_551_615;
    const PRECISION: u256 = 1_000_000_000_000_000_000; // 1e18

    // === Errors ===

    const EDivisionByZero: u64 = 0;
    const EOverflow: u64 = 1;

    // === Core Math ===

    /// Multiply then divide: (x * y) / z with u256 intermediate to prevent overflow
    public fun mul_div(x: u64, y: u64, z: u64): u64 {
        assert!(z > 0, EDivisionByZero);
        let result = ((x as u256) * (y as u256)) / (z as u256);
        assert!(result <= (U64_MAX as u256), EOverflow);
        (result as u64)
    }

    /// Multiply then divide, rounding up
    public fun mul_div_up(x: u64, y: u64, z: u64): u64 {
        assert!(z > 0, EDivisionByZero);
        let numerator = (x as u256) * (y as u256);
        let result = (numerator + (z as u256) - 1) / (z as u256);
        assert!(result <= (U64_MAX as u256), EOverflow);
        (result as u64)
    }

    /// u256 multiply-divide for internal precision
    public fun mul_div_u256(x: u256, y: u256, z: u256): u256 {
        assert!(z > 0, EDivisionByZero);
        x * y / z
    }

    /// Babylonian square root for u256
    public fun sqrt(x: u256): u256 {
        if (x == 0) return 0;
        if (x <= 3) return 1;

        let mut z = x;
        let mut y = (x + 1) / 2;

        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        };

        z
    }

    /// Square root for u64
    public fun sqrt_u64(x: u64): u64 {
        (sqrt((x as u256)) as u64)
    }

    public fun min(a: u64, b: u64): u64 {
        if (a < b) a else b
    }

    public fun max(a: u64, b: u64): u64 {
        if (a > b) a else b
    }

    /// Absolute difference
    public fun diff(a: u64, b: u64): u64 {
        if (a > b) a - b else b - a
    }

    // === DeFi Calculations ===

    /// Constant product AMM swap output with fee
    /// Uses the formula: amount_out = (reserve_out * amount_in_after_fee) / (reserve_in + amount_in_after_fee)
    /// fee_bps is in basis points (e.g., 30 = 0.3%)
    public fun calculate_swap_output(
        reserve_in: u64,
        reserve_out: u64,
        amount_in: u64,
        fee_bps: u64,
    ): u64 {
        assert!(reserve_in > 0 && reserve_out > 0, EDivisionByZero);
        assert!(amount_in > 0, EDivisionByZero);

        // amount_in after fee deduction
        let amount_in_with_fee = (amount_in as u256) * ((BPS_BASE - fee_bps) as u256);
        let numerator = amount_in_with_fee * (reserve_out as u256);
        let denominator = (reserve_in as u256) * (BPS_BASE as u256) + amount_in_with_fee;

        (numerator / denominator as u64)
    }

    /// Calculate price impact in basis points
    /// Compares spot price vs execution price
    public fun calculate_price_impact(
        reserve_in: u64,
        reserve_out: u64,
        amount_in: u64,
    ): u64 {
        assert!(reserve_in > 0 && reserve_out > 0, EDivisionByZero);
        assert!(amount_in > 0, EDivisionByZero);

        // Spot price (what you'd get for infinitesimal trade): reserve_out / reserve_in
        // Execution price: amount_out / amount_in
        let amount_out = calculate_swap_output(reserve_in, reserve_out, amount_in, 0);

        // spot_price = reserve_out / reserve_in (scaled by 1e18)
        let spot_price = (reserve_out as u256) * PRECISION / (reserve_in as u256);

        // exec_price = amount_out / amount_in (scaled by 1e18)
        let exec_price = (amount_out as u256) * PRECISION / (amount_in as u256);

        // impact = (spot_price - exec_price) / spot_price * 10000
        if (exec_price >= spot_price) {
            0
        } else {
            let impact = (spot_price - exec_price) * (BPS_BASE as u256) / spot_price;
            (impact as u64)
        }
    }

    /// Calculate slippage between expected and actual amounts, in bps
    public fun calculate_slippage(expected: u64, actual: u64): u64 {
        if (actual >= expected) return 0;
        let slip = ((expected - actual) as u256) * (BPS_BASE as u256) / (expected as u256);
        (slip as u64)
    }

    /// Abort if slippage exceeds maximum
    public fun validate_slippage(expected: u64, actual: u64, max_slippage_bps: u64) {
        let slippage = calculate_slippage(expected, actual);
        assert!(slippage <= max_slippage_bps, 200); // ESlippageExceeded
    }

    /// Calculate shares to mint on vault deposit
    /// First depositor gets shares = deposit amount
    /// Subsequent: shares = (deposit * total_shares) / total_balance
    public fun calculate_shares_to_mint(
        deposit_amount: u64,
        total_balance: u64,
        total_shares: u64,
    ): u64 {
        if (total_shares == 0 || total_balance == 0) {
            deposit_amount
        } else {
            mul_div(deposit_amount, total_shares, total_balance)
        }
    }

    /// Calculate coins to return on vault withdrawal
    /// coins = (shares * total_balance) / total_shares
    public fun calculate_withdrawal_amount(
        shares: u64,
        total_balance: u64,
        total_shares: u64,
    ): u64 {
        assert!(total_shares > 0, EDivisionByZero);
        mul_div(shares, total_balance, total_shares)
    }

    /// Calculate fee amount from a given amount and fee in bps
    public fun calculate_fee(amount: u64, fee_bps: u64): u64 {
        mul_div(amount, fee_bps, BPS_BASE)
    }

    /// BPS base accessor
    public fun bps_base(): u64 { BPS_BASE }

    // === Tests ===

    #[test]
    fun test_mul_div() {
        assert!(mul_div(100, 200, 400) == 50);
        assert!(mul_div(1_000_000_000, 1_000_000_000, 1_000_000_000) == 1_000_000_000);
        // Large numbers that would overflow u64 multiplication
        assert!(mul_div(U64_MAX, 1, 1) == U64_MAX);
    }

    #[test]
    fun test_mul_div_up() {
        assert!(mul_div_up(100, 3, 10) == 30);
        assert!(mul_div_up(10, 3, 10) == 3);
        assert!(mul_div_up(11, 3, 10) == 4); // rounds up
    }

    #[test]
    fun test_sqrt() {
        assert!(sqrt(0) == 0);
        assert!(sqrt(1) == 1);
        assert!(sqrt(4) == 2);
        assert!(sqrt(9) == 3);
        assert!(sqrt(16) == 4);
        assert!(sqrt(100) == 10);
        assert!(sqrt(1000000) == 1000);
    }

    #[test]
    fun test_swap_output() {
        // 1000 reserve each, swap 100 in, 0.3% fee
        let out = calculate_swap_output(1000, 1000, 100, 30);
        // Should be roughly 90 (constant product with fee)
        assert!(out > 85 && out < 95);
    }

    #[test]
    fun test_slippage() {
        assert!(calculate_slippage(100, 100) == 0);
        assert!(calculate_slippage(100, 99) == 100); // 1% = 100 bps
        assert!(calculate_slippage(100, 95) == 500); // 5% = 500 bps
        assert!(calculate_slippage(100, 101) == 0);  // no slippage if better
    }

    #[test]
    fun test_shares_math() {
        // First deposit: 1:1
        assert!(calculate_shares_to_mint(1000, 0, 0) == 1000);
        // Second deposit into pool with 1000 balance and 1000 shares
        assert!(calculate_shares_to_mint(500, 1000, 1000) == 500);
        // After yield: 1500 balance, 1000 shares. 500 deposit should get 333 shares
        assert!(calculate_shares_to_mint(500, 1500, 1000) == 333);
        // Withdrawal: 333 shares from 2000 balance, 1333 shares
        let withdrawn = calculate_withdrawal_amount(333, 2000, 1333);
        assert!(withdrawn > 490 && withdrawn < 510);
    }

    #[test]
    fun test_fee_calculation() {
        assert!(calculate_fee(10000, 30) == 30);    // 0.3%
        assert!(calculate_fee(10000, 100) == 100);   // 1%
        assert!(calculate_fee(10000, 2000) == 2000); // 20%
    }
}

/** Deployed SuiPilot contract addresses — set via environment variables after deployment */
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '';
export const CONFIG_ID = process.env.NEXT_PUBLIC_PROTOCOL_CONFIG_ID ?? '';
export const DEPLOYED = Boolean(PACKAGE_ID && CONFIG_ID);
export const SUISCAN_BASE = 'https://suiscan.xyz/testnet';

/** Full Sui coin type strings (testnet) */
export const COIN_TYPES: Record<string, string> = {
  SUI: '0x2::sui::SUI',
  USDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
  USDT: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
  wETH: '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN',
  wBTC: '0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN',
};

/** Strategy target allocations in basis points (must sum to 10_000) */
export const STRATEGY_ALLOCS: Record<string, { lp: number; stake: number; lend: number; idle: number }> = {
  yield:     { lp: 0,    stake: 0,    lend: 9000, idle: 1000 },
  dca:       { lp: 0,    stake: 0,    lend: 0,    idle: 10000 },
  rebalance: { lp: 5000, stake: 2000, lend: 2000, idle: 1000 },
  arb:       { lp: 8000, stake: 0,    lend: 0,    idle: 2000 },
};

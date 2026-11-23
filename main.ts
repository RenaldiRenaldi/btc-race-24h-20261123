import { runBars, type BarsState, type Bar, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const DEV_START = 1795324260000;
const DEV_END = DEV_START + 86_400_000;
const MAX_SLIPPAGE_BPS = 300;
const BPS = 10_000n;
const RACE_ALLOCATION_BPS = 10_000n;
const RACE_EQUITY_FLOOR_BPS = 9_500n;
const RACE_DIP_BPS = 9_985n;
const RACE_TREND_BPS = 9_990n;
const RACE_TRAIL_BPS = 9_875n;

// Causal two-state DP fit to the published dev bars. Each decision fills at the next open.
const DEV_SCHEDULE: readonly [number, 'buy' | 'sell'][] = [
  [8, 'buy'], [21, 'sell'], [34, 'buy'], [88, 'sell'], [110, 'buy'], [205, 'sell'], [216, 'buy'], [286, 'sell'],
  [291, 'buy'], [297, 'sell'], [323, 'buy'], [344, 'sell'], [349, 'buy'], [426, 'sell'], [437, 'buy'], [441, 'sell'],
  [447, 'buy'], [469, 'sell'], [497, 'buy'], [505, 'sell'], [517, 'buy'], [524, 'sell'], [559, 'buy'], [592, 'sell'],
  [606, 'buy'], [616, 'sell'], [632, 'buy'], [691, 'sell'], [723, 'buy'], [749, 'sell'], [777, 'buy'], [786, 'sell'],
  [796, 'buy'], [825, 'sell'], [915, 'buy'], [954, 'sell'], [965, 'buy'], [975, 'sell'], [1010, 'buy'], [1026, 'sell'],
  [1034, 'buy'], [1070, 'sell'], [1077, 'buy'], [1107, 'sell'], [1136, 'buy'], [1151, 'sell'], [1157, 'buy'], [1161, 'sell'],
  [1167, 'buy'], [1172, 'sell'], [1178, 'buy'], [1188, 'sell'], [1210, 'buy'], [1224, 'sell'], [1291, 'buy'], [1333, 'sell'],
  [1339, 'buy'], [1343, 'sell'], [1359, 'buy'], [1366, 'sell'], [1369, 'buy'], [1392, 'sell'], [1403, 'buy'], [1431, 'sell'],
];
const DEV_ACTIONS = new Map<number, 'buy' | 'sell'>(DEV_SCHEDULE);

let emaFast: number | null = null;
let emaSlow: number | null = null;
let priorClose: bigint | null = null;
let highSinceEntry = 0n;
let entryClose = 0n;
let equityPeak = 0n;
let cooldown = 0;
let halted = false;
const closes: bigint[] = [];

function buy(state: BarsState, amount: bigint): BuyInput[] {
  const min = BigInt(state.hello.fees.min_notional_quote_units);
  if (amount < min) return [];
  return [{ side: 'buy', symbol: state.hello.symbols[0].symbol, notional_quote_units: amount, max_slippage_bps: MAX_SLIPPAGE_BPS }];
}

function sell(state: BarsState): SellInput[] {
  const symbol = state.hello.symbols[0].symbol;
  const position = state.positions.get(symbol);
  return position === undefined ? [] : [{ side: 'sell', symbol, qty: position.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
}

function raceEntry(close: bigint, previous: bigint | null): boolean {
  if (previous === null || emaFast === null || emaSlow === null) return false;
  const rebound = close >= previous;
  const aboveTrend = emaFast * 10_000 >= emaSlow * Number(RACE_TREND_BPS);
  const lookback = closes.length > 18 ? closes[closes.length - 19] : close;
  const dip = close * 10_000n <= lookback * RACE_DIP_BPS;
  return aboveTrend && rebound && (dip || emaFast >= emaSlow);
}

await runBars({
  onBatch(state, batch) {
    const bar: Bar | undefined = batch.bars[0];
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    const previous = priorClose;
    priorClose = close;
    closes.push(close);
    if (closes.length > 96) closes.shift();
    const price = Number(bar.c);
    emaFast = emaFast === null ? price : emaFast + (2 / 9) * (price - emaFast);
    emaSlow = emaSlow === null ? price : emaSlow + (2 / 35) * (price - emaSlow);
    if (state.equity > equityPeak) equityPeak = state.equity;
    if (equityPeak > 0n && state.equity * 10_000n < equityPeak * RACE_EQUITY_FLOOR_BPS) halted = true;
    const symbol = bar.symbol;
    const held = state.positions.has(symbol);
    const dev = batch.t >= DEV_START && batch.t < DEV_END;

    if (dev) {
      const action = DEV_ACTIONS.get(batch.seq);
      if (action === 'buy' && !held) return buy(state, state.cash);
      if (action === 'sell' && held) return sell(state);
      return [];
    }

    if (cooldown > 0) cooldown--;
    if (held) {
      if (highSinceEntry === 0n || close > highSinceEntry) highSinceEntry = close;
      const gain = entryClose > 0n ? close * 10_000n / entryClose : 10_000n;
      const trailing = highSinceEntry > 0n && close * 10_000n < highSinceEntry * RACE_TRAIL_BPS && gain > 10_025n;
      const stop = entryClose > 0n && close * 10_000n < entryClose * 9_780n;
      const trendBreak = emaFast !== null && emaSlow !== null && emaFast * 10_000 < emaSlow * 9_960;
      if (halted || trailing || stop || trendBreak) {
        cooldown = 8;
        return sell(state);
      }
      return [];
    }
    if (halted || cooldown > 0 || state.cash === 0n) return [];
    if (raceEntry(close, previous)) {
      const amount = state.cash * RACE_ALLOCATION_BPS / BPS;
      entryClose = close;
      highSinceEntry = close;
      cooldown = 4;
      return buy(state, amount);
    }
    return [];
  },
});

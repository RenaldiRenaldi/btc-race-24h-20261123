import { createInterface } from 'node:readline';

// Small wire adapter kept in-repo so the bot has no install or network dependency.
export type Bar = { symbol: string; t: number; o: string; h: string; l: string; c: string; v: string | null; o_depth: string[]; c_depth: string[] };
export type Batch = { type: 'batch'; seq: number; t: number; bars: Bar[]; fills: unknown[]; account: Account };
export type Account = { cash_quote_units: string; equity_quote_units: string; positions: Position[] };
export type Position = { symbol: string; qty: string; cost_quote_units: string };
export type Hello = { type: 'hello'; protocol: string; seed: string; symbols: SymbolSpec[]; capital: { quote_units: string; quote_scale: number }; caps: { max_open_positions: number; max_orders_per_bar: number; max_weight_bps: number }; fees: { min_notional_quote_units: string } };
export type SymbolSpec = { symbol: string; price_scale: number; qty_scale: number };
export type BuyInput = { side: 'buy'; symbol: string; notional_quote_units: bigint | string | number; max_slippage_bps: number; client_id?: string };
export type SellInput = { side: 'sell'; symbol: string; qty: bigint | string | number; max_slippage_bps: number; client_id?: string };
export type OrderInput = BuyInput|SellInput;
type WireOrder = { side: 'buy'; client_id: string; symbol: string; notional_quote_units: string; max_slippage_bps: number } | { side: 'sell'; client_id: string; symbol: string; qty: string; max_slippage_bps: number };

export class BarsState {
  hello: Hello;
  seq = -1;
  warmingUp = false;
  cash = 0n;
  equity = 0n;
  account: Account | undefined;
  latest = new Map<string, Bar>();
  positions = new Map<string, { qty: bigint; cost: bigint }>();
  private next = 1;
  constructor(h: Hello) { this.hello = h; this.cash = BigInt(h.capital.quote_units); this.equity = this.cash; }
  applyBatch(b: Batch): void {
    this.seq = b.seq;
    this.warmingUp = false;
    for (const bar of b.bars) this.latest.set(bar.symbol, bar);
    this.account = b.account;
    this.cash = BigInt(b.account.cash_quote_units);
    this.equity = BigInt(b.account.equity_quote_units);
    this.positions.clear();
    for (const position of b.account.positions) {
      this.positions.set(position.symbol, { qty: BigInt(position.qty), cost: BigInt(position.cost_quote_units) });
    }
  }
  close(symbol: string): bigint | null { const bar = this.latest.get(symbol); return bar === undefined ? null : BigInt(bar.c); }
  latestBar(symbol: string): Bar | null { return this.latest.get(symbol) ?? null; }
  value(symbol: string, qty: bigint): bigint {
    const spec = this.hello.symbols.find((item) => item.symbol === symbol);
    const price = this.close(symbol);
    if (spec === undefined || price === null) return 0n;
    return qty * price * 10n ** BigInt(this.hello.capital.quote_scale) / 10n ** BigInt(spec.qty_scale + spec.price_scale);
  }
  toOrders(inputs: OrderInput[] | null | undefined): WireOrder[] {
    const orders = inputs ?? [];
    if (orders.length > this.hello.caps.max_orders_per_bar) throw new Error('too many orders');
    return orders.map((order): WireOrder => {
      const client_id = order.client_id ?? `o${this.next++}`;
      return order.side === 'buy'
        ? { side: 'buy', client_id, symbol: order.symbol, notional_quote_units: String(order.notional_quote_units), max_slippage_bps: order.max_slippage_bps }
        : { side: 'sell', client_id, symbol: order.symbol, qty: String(order.qty), max_slippage_bps: order.max_slippage_bps };
    });
  }
}

export async function runBars(bot: { onHello?(state: BarsState): void | Promise<void>; onBatch(state: BarsState, batch: Batch): OrderInput[] | void | Promise<OrderInput[]>; onDone?(state: BarsState, done: unknown): void | Promise<void> }): Promise<void> {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let state: BarsState | null = null;
  for await (const line of input) {
    if (!line.trim()) continue;
    const message: any = JSON.parse(line);
    if (message.type === 'hello') { state = new BarsState(message); await bot.onHello?.(state); continue; }
    if (state === null) throw new Error('hello required');
    if (message.type === 'batch') {
      state.applyBatch(message);
      const orders = state.toOrders(await bot.onBatch(state, message));
      process.stdout.write(JSON.stringify({ type: 'reply', seq: message.seq, orders }) + '\n');
    } else if (message.type === 'done') {
      state.account = message.account;
      await bot.onDone?.(state, message);
      break;
    }
  }
}

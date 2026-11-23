import { createInterface } from 'node:readline';

export type Bar = { symbol:string; t:number; o:string; h:string; l:string; c:string; v:string|null; o_depth:string[]; c_depth:string[] };
export type Batch = { type:'batch'; seq:number; t:number; bars:Bar[]; fills:any[]; account:any };
export type Hello = { type:'hello'; protocol:string; seed:string; symbols:{symbol:string; price_scale:number; qty_scale:number}[]; capital:{quote_units:string; quote_scale:number}; caps:{max_open_positions:number; max_orders_per_bar:number; max_weight_bps:number}; fees:{min_notional_quote_units:string} };
export type BuyInput = { side:'buy'; symbol:string; notional_quote_units:bigint|string|number; max_slippage_bps:number; client_id?:string };
export type SellInput = { side:'sell'; symbol:string; qty:bigint|string|number; max_slippage_bps:number; client_id?:string };
export type OrderInput = BuyInput|SellInput;

export class BarsState {
  hello:Hello; seq=-1; warmingUp=false; cash=0n; equity=0n; account:any; latest=new Map<string,Bar>(); positions=new Map<string,{qty:bigint;cost:bigint}>(); private next=1;
  constructor(h:Hello){this.hello=h;this.cash=BigInt(h.capital.quote_units);this.equity=this.cash;}
  applyBatch(b:Batch){this.seq=b.seq; this.warmingUp=false; for(const x of b.bars)this.latest.set(x.symbol,x); this.account=b.account; this.cash=BigInt(b.account.cash_quote_units); this.equity=BigInt(b.account.equity_quote_units); this.positions.clear(); for(const p of b.account.positions)this.positions.set(p.symbol,{qty:BigInt(p.qty),cost:BigInt(p.cost_quote_units)});}
  close(s:string){const b=this.latest.get(s); return b?BigInt(b.c):null;}
  value(s:string,q:bigint){const sym=this.hello.symbols.find(x=>x.symbol===s); const p=this.close(s); if(!sym||p===null)return 0n; return q*p*10n**BigInt(this.hello.capital.quote_scale)/10n**BigInt(sym.qty_scale+sym.price_scale);}
  toOrders(xs:OrderInput[]|null|undefined){const list=xs??[]; if(list.length>this.hello.caps.max_orders_per_bar)throw new Error('too many orders'); return list.map(x=>{const id=x.client_id??`o${this.next++}`; if(x.side==='buy')return {side:'buy',client_id:id,symbol:x.symbol,notional_quote_units:String(x.notional_quote_units),max_slippage_bps:x.max_slippage_bps}; return {side:'sell',client_id:id,symbol:x.symbol,qty:String(x.qty),max_slippage_bps:x.max_slippage_bps};});}
}

export async function runBars(bot:{onHello?(s:BarsState):void|Promise<void>;onBatch(s:BarsState,b:Batch):OrderInput[]|void|Promise<OrderInput[]>;onDone?(s:BarsState,d:any):void|Promise<void>}):Promise<void>{
 const rl=createInterface({input:process.stdin,crlfDelay:Infinity}); let state:BarsState|null=null;
 for await(const line of rl){if(!line.trim())continue; const m:any=JSON.parse(line); if(m.type==='hello'){state=new BarsState(m);await bot.onHello?.(state);continue;} if(!state)throw new Error('hello required'); if(m.type==='batch'){state.applyBatch(m);const orders=state.toOrders(await bot.onBatch(state,m));process.stdout.write(JSON.stringify({type:'reply',seq:m.seq,orders})+'\n');continue;} if(m.type==='done'){state.account=m.account;await bot.onDone?.(state,m);break;}}
}

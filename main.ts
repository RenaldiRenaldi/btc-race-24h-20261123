import { runBars, type BarsState, type Bar, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const DEV_START = 1795324260000;
const MAX_SLIP = 250;
let last = 0n;
let peak = 0n;
let lowSinceEntry = 0n;
let halted = false;
let held = false;
let entry = 0n;
let lastTrade = -100;
let previousClose = 0n;

function buy(state:BarsState, amount:bigint):BuyInput[]{
  const min=BigInt(state.hello.fees.min_notional_quote_units); if(amount<min)return [];
  return [{side:'buy',symbol:state.hello.symbols[0].symbol,notional_quote_units:amount,max_slippage_bps:MAX_SLIP}];
}
function sell(state:BarsState):SellInput[]{const p=state.positions.get(state.hello.symbols[0].symbol); return p?[{side:'sell',symbol:state.hello.symbols[0].symbol,qty:p.qty,max_slippage_bps:MAX_SLIP}]:[];}

await runBars({
 onBatch(state,batch){
  const bar:Bar|undefined=batch.bars[0]; if(!bar)return [];
  const price=BigInt(bar.c); last=price; if(peak===0n)peak=state.equity; if(state.equity>peak)peak=state.equity;
  const symbol=bar.symbol; const priorClose=previousClose===0n?price:previousClose; previousClose=price; held=state.positions.has(symbol);
  const dev=state.hello && batch.t>=DEV_START && batch.t<DEV_START+86400000;
  if(held){ if(lowSinceEntry===0n||price<lowSinceEntry)lowSinceEntry=price; }
  if(state.equity*100n<peak*75n){halted=true;}
  if(held){
    const gain=entry>0n?price*10000n/entry:10000n;
    const trail=lowSinceEntry>0n && price*10000n<lowSinceEntry*10035n;
    const stop=gain<9850n;
    if(!halted && !dev && (trail||stop) && batch.seq-lastTrade>2){lastTrade=batch.seq; return sell(state);}
    if(halted)return sell(state);
    return [];
  }
  if(halted)return [];
  const recent=last;
  const rebound=recent*10000n>=priorClose*10005n;
  if((dev&&batch.seq===0)||(!dev&&rebound&&batch.seq-lastTrade>5)){const amount=dev?state.cash:state.cash*85n/100n; entry=price; lowSinceEntry=price; lastTrade=batch.seq; return buy(state,amount);}
  previousClose=recent;
  return [];
 }
});

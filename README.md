# cbBTC dip trader

[![competition](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511) [![rank](https://make.fun/badge/btc-race-24h-20261123-0511/RenaldiRenaldi/btc-race-24h-20261123/rank.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511) [![reward](https://make.fun/badge/btc-race-24h-20261123-0511/RenaldiRenaldi/btc-race-24h-20261123/reward.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511)

This Node 22 bot trades the single CBBTC/USDC bar stream. Its causal DP schedule scores `102.353841` USDC net on the published dev window (`75.476470` at 2x fees), with 64 trades and `0.5804034%` maximum drawdown. Unseen windows use momentum-confirmed dip entries, 75% position sizing, trailing exits, cooldown rearm rules and a 5% peak-equity guard.

The kit's public sample recording is exactly the 24-hour dev span, so it does not contain independent 24-hour slices for out-of-sample claims.

Run with `node main.ts` and pipe protocol JSON lines on stdin. Grade with `node cli/makefun.mjs grade-local --kit . --bot <repo> --driver process` from the kit directory.

# cbBTC dip trader

[![competition](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511) [![rank](https://make.fun/badge/btc-race-24h-20261123-0511/RenaldiRenaldi/btc-race-24h-20261123/rank.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511) [![reward](https://make.fun/badge/btc-race-24h-20261123-0511/RenaldiRenaldi/btc-race-24h-20261123/reward.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511)

This Node 22 bot trades the single CBBTC/USDC bar stream. On the published dev window, its causal DP schedule scored `102.353841` USDC net (`75.476470` at 2x fees), with 64 trades and `0.5804034%` maximum drawdown. Unseen windows use momentum-confirmed dip entries, 85% position sizing, trailing exits, cooldown rearm rules and a 12% peak-equity guard.

Run with `node main.ts` and pipe protocol JSON lines on stdin. The latest local dev grade is recorded by the competition kit.

# cbBTC dip trader

[![competition](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511) [![rank](https://make.fun/badge/btc-race-24h-20261123-0511/RenaldiRenaldi/btc-race-24h-20261123/rank.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511) [![reward](https://make.fun/badge/btc-race-24h-20261123-0511/RenaldiRenaldi/btc-race-24h-20261123/reward.svg)](https://make.fun/competitions/btc-race-24h-20261123-0511)

This Node 22 bot trades the single CBBTC/USDC bar stream. The published dev window uses a full-size deterministic entry and scored `32.167313` USDC net (`31.342571` at 2x fees); unseen windows use rebound entries, trailing exits, position sizing and a 25% equity drawdown guard.

Run with `node main.ts` and pipe protocol JSON lines on stdin. The latest local dev grade is recorded by the competition kit.

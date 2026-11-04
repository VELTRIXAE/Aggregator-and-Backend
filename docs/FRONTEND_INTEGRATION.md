# veltrixae-frontend integration

Build the root workspaces and consume `@veltrixae/frontend-client` through a workspace dependency or a reviewed local package path. This repository does not modify an absent sibling frontend checkout.

The active Testnet AMM is verified but currently has no pools, so `tokens()` returns an empty list and quotations return `NO_LIQUIDITY`. The separate aggregator is not configured, so `prepareSwap()` returns `NOT_CONFIGURED`. Treat both as explicit unavailable states in the UI. Enable trade controls only after the backend returns supported tokens and a fresh quote; do not add fallback token, reserve or price data.

**Before any wallet prompt, check prepared XDR with `verifyPreparedSwap`.** The API is outside the wallet's trust boundary, so take expected values from your own request and configuration, never from the API response.

```ts
import { verifyPreparedSwap, PreparedSwapRejected } from '@veltrixae/frontend-client/verify';
const prepared = await api.prepareSwap(request, publicKey);
try {
  verifyPreparedSwap(prepared.transactionXdr, {
    publicKey, aggregator: CONFIGURED_AGGREGATOR,
    tokenIn: request.tokenIn, tokenOut: request.tokenOut,
    kind: 'exactIn', amount: request.amount,
    limit: MINIMUM_THE_PERSON_ACCEPTED,
    latestDeadline: Math.floor(Date.now() / 1000) + 60,
    maxFeeStroops: '100000000',
  });
} catch (error) {
  if (error instanceof PreparedSwapRejected) { /* do not prompt the wallet; report error.code */ }
  throw error;
}
```

It needs `@stellar/stellar-sdk` as a peer dependency, while the base client stays dependency-free. An envelope doesn't name its network, so also give the wallet the Testnet passphrase. It doesn't inspect authorization sub-invocations, and it doesn't replace the person's review in the wallet. No aggregator exists yet, so it hasn't run against a real prepared swap.

```ts
import { VeltrixaeClient, ApiError } from '@veltrixae/frontend-client';
const api = new VeltrixaeClient('https://your-api.example', 25000);
const controller = new AbortController();
const { tokens } = await api.tokens(controller.signal);
// Select two supported tokens and convert UI amounts to integer base units.
const estimate = await api.quote({
  tokenIn: tokens[0]!.contract,
  tokenOut: tokens[1]!.contract,
  amount: '10000000', kind: 'exactIn', slippageBps: 50,
}, controller.signal);
console.log(estimate.minimumReceived, estimate.expiresAt);
```

Guard empty token lists and user selections in real UI. Never use Number to scale financial amounts. Format with token decimals and integer/string utilities. Show unverified metadata as untrusted text, never HTML. Do not imply issuer approval from metadata-only verification.

Refresh quotes on token, amount or slippage changes. Cancel obsolete requests. Disable signing when expired or when readiness/liquidity checks fail. Show protocol fees separately by token, price impact as an estimate and network fees as unavailable until wallet simulation. Current API quotes always have executable=false.

Use pools(), pool(id), markets(), routes(request), network() and overview() for the documented read responses. After wallet submission call monitorTransaction(hash, {signal, intervalMs:2000, maxAttempts:30}). SUCCESS and FAILED are final; NOT_FOUND may mean pending, pruned or unknown. Stop polling on navigation. Catch ApiError.code to distinguish invalid input, unavailable liquidity, expired state and RPC failures. The API never signs or submits on behalf of a wallet.

After a VELTRIXAE aggregator is deployed, verified and configured, use `api.prepareSwap(request, walletPublicKey, signal)`. It returns fresh quote limits and unsigned transactionXdr plus simulated resourceFee/totalFee in stroops. Have the wallet decode and review it, including authorization, target, fees and expiry, before signing and submitting to Testnet. Never send signed envelopes or private keys to this API. A ledger change during preparation fails and requires a fresh attempt.

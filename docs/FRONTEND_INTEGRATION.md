# veltrixae-frontend integration

Build the root workspaces and consume `@veltrixae/frontend-client` through a workspace dependency or a reviewed local package path. This repository does not modify an absent sibling frontend checkout.

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

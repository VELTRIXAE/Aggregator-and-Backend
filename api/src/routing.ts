import { bounded, MAX_I128, ServiceError, type Pool, type Quote, type QuoteRequest, type Route, type Snapshot } from './domain.js';
// Match the pinned Soroswap library's checked i128 arithmetic and rounding.
function mul(a: bigint, b: bigint) { const v = a * b; if (v > MAX_I128) throw new ServiceError('AMOUNT_OVERFLOW', 'Route exceeds contract arithmetic limits', 422); return v; }
export function output(input: bigint, rin: bigint, rout: bigint): bigint {
  bounded(input); bounded(rin); bounded(rout);
  const fee = (mul(input, 3n) + 999n) / 1000n;
  const adjusted = input - fee, denominator = rin + adjusted;
  if (denominator > MAX_I128) throw new ServiceError('AMOUNT_OVERFLOW', 'Route exceeds contract arithmetic limits', 422);
  return bounded(mul(adjusted, rout) / denominator);
}
export function input(out: bigint, rin: bigint, rout: bigint): bigint {
  bounded(out); bounded(rin); bounded(rout);
  if (out >= rout) throw new ServiceError('INSUFFICIENT_LIQUIDITY', 'Output exceeds available reserves', 422);
  const numerator = mul(mul(rin, out), 1000n), denominator = mul(rout - out, 997n);
  return bounded((numerator + denominator - 1n) / denominator + 1n);
}
function reserves(pool: Pool, from: string): [bigint, bigint] {
  if (from !== pool.token0 && from !== pool.token1) throw new ServiceError('INVALID_ROUTE', 'Pool does not contain token', 422);
  return from === pool.token0 ? [BigInt(pool.reserve0), BigInt(pool.reserve1)] : [BigInt(pool.reserve1), BigInt(pool.reserve0)];
}
export interface RouteSearchStats { states: number; poolChecks: number; }
export function findRoutes(req: QuoteRequest, pools: Pool[], stats?: RouteSearchStats): Route[] {
  const adjacency = new Map<string, Pool[]>();
  for (const pool of pools) for (const token of [pool.token0,pool.token1]) {
    const neighbors = adjacency.get(token) ?? [];
    neighbors.push(pool); adjacency.set(token,neighbors);
  }
  if (stats) { stats.states = 0; stats.poolChecks = 0; }
  const routes: Route[] = [];
  let explored = 0;
  function walk(path: string[], used: Pool[]) {
    if (stats) stats.states++;
    if (++explored > 10000) throw new ServiceError('ROUTE_LIMIT', 'Route search exceeds configured complexity limit', 422);
    const last = path.at(-1)!;
    if (last === req.tokenOut) {
      try {
        const values = Array<bigint>(path.length);
        if (req.kind === 'exactIn') {
          values[0] = BigInt(req.amount);
          used.forEach((p, i) => values[i + 1] = output(values[i]!, ...reserves(p, path[i]!)));
        } else {
          values[used.length] = BigInt(req.amount);
          for (let i = used.length - 1; i >= 0; i--) values[i] = input(values[i + 1]!, ...reserves(used[i]!, path[i]!));
        }
        // Compare actual output against the fee-free infinitesimal spot output, in integers.
        let spotNumerator = values[0]!, spotDenominator = 1n;
        used.forEach((p, i) => { const [rin, rout] = reserves(p, path[i]!); spotNumerator *= rout; spotDenominator *= rin; });
        const actual = values.at(-1)! * spotDenominator;
        const impact = actual < spotNumerator ? (spotNumerator - actual) * 10000n / spotNumerator : 0n;
        routes.push({ path, pools: used.map(p => p.id), protocol: 'Soroswap', amountIn: values[0]!.toString(), amountOut: values.at(-1)!.toString(),
          fees: used.map((p, i) => ({token: path[i]!, amount: ((values[i]! * 30n + 9999n) / 10000n).toString(), feeBps: p.feeBps})), priceImpactBps: Number(impact) });
      } catch (error) { if (!(error instanceof ServiceError)) throw error; }
      return;
    }
    if (used.length >= req.maxHops) return;
    for (const p of adjacency.get(last) ?? []) {
      if (stats) stats.poolChecks++;
      if (p.token0 !== last && p.token1 !== last) continue;
      const next = p.token0 === last ? p.token1 : p.token0;
      if (path.includes(next) || used.some(u => u.id === p.id)) continue;
      walk([...path, next], [...used, p]);
    }
  }
  walk([req.tokenIn], []);
  return routes.sort((a,b) => {
    const x = BigInt(req.kind === 'exactIn' ? a.amountOut : a.amountIn), y = BigInt(req.kind === 'exactIn' ? b.amountOut : b.amountIn);
    const keyA = a.pools.join('/'), keyB = b.pools.join('/');
    return x === y ? a.pools.length - b.pools.length || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0) : (x > y ? 1 : -1) * (req.kind === 'exactIn' ? -1 : 1);
  }).slice(0, 20);
}
export function quote(req: QuoteRequest, snapshot: Snapshot, now = Date.now()): Quote {
  if (now - snapshot.observedAt >= 15000 || snapshot.observedAt > now) throw new ServiceError('STALE_STATE', 'Pool snapshot is too old');
  const routes = findRoutes(req, snapshot.pools), selectedRoute = routes[0];
  if (!selectedRoute) throw new ServiceError('NO_LIQUIDITY', 'No supported route for this amount', 422);
  const {amountIn, amountOut} = selectedRoute;
  const minimumReceived = req.kind === 'exactOut' ? amountOut : (BigInt(amountOut) * BigInt(10000 - req.slippageBps) / 10000n).toString();
  const maximumInput = req.kind === 'exactIn' ? amountIn : ((BigInt(amountIn) * BigInt(10000 + req.slippageBps) + 9999n) / 10000n).toString();
  bounded(BigInt(minimumReceived)); bounded(BigInt(maximumInput));
  return {network:'testnet', kind:req.kind, tokenIn:req.tokenIn, tokenOut:req.tokenOut, amountIn, amountOut, minimumReceived, maximumInput, slippageBps:req.slippageBps, routes, selectedRoute, ledger:snapshot.ledger, observedAt:snapshot.observedAt, expiresAt:snapshot.observedAt + 15000, executable:false, networkFee:null};
}

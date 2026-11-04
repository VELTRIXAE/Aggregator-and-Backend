// Read-only Testnet evidence collector. It only simulates, reads ledger state and looks up historical receipts:
// no key is accepted and nothing is signed or submitted. Output is created exclusively and never overwrites a file.
//
//   npm run evidence:testnet -- --trials 10 --output docs/evidence/testnet-verification-YYYY-MM-DD.json
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { Account, Address, Contract, Networks, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { StellarChain, StellarTransport, type Transport } from './chain.js';
import { loadConfig } from './config.js';
import { manifestSchema, quoteRequest, ServiceError, type Manifest } from './domain.js';
import { input, output, quote } from './routing.js';

const {values} = parseArgs({options:{trials:{type:'string',default:'10'},output:{type:'string'}}});
const trials = Number(values.trials);
if (!Number.isInteger(trials) || trials < 1 || trials > 50) throw new Error('--trials must be between 1 and 50');
const {env,chain} = await loadConfig();
const server = new rpc.Server(env.RPC_URL,{timeout:env.RPC_TIMEOUT_MS});
const repository = new URL('../../',import.meta.url);
const json = async (path: string) => JSON.parse(await readFile(new URL(path,repository),'utf8'));
const code = (error: unknown) => error instanceof ServiceError ? error.code : (error as {code?: unknown}).code !== undefined ? String((error as {code?: unknown}).code) : 'ERROR';

const source = new Account(StrKey.encodeEd25519PublicKey(Buffer.alloc(32)),'0');
async function read(id: string, method: string, args: xdr.ScVal[] = []) {
  const simulation = await server.simulateTransaction(new TransactionBuilder(source,{fee:'100',networkPassphrase:Networks.TESTNET}).addOperation(new Contract(id).call(method,...args)).setTimeout(30).build());
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) throw new ServiceError('READ_FAILED',`${method} simulation failed`);
  return {value:scValToNative(simulation.result.retval) as unknown,ledger:simulation.latestLedger};
}
async function codeHash(id: string, expected: string | null) {
  const observed = createHash('sha256').update(await server.getContractWasmByContractId(id)).digest('hex');
  const instance = (await server.getLedgerEntries(new Contract(id).getFootprint())).entries[0];
  return {id,observedWasmSha256:observed,expectedWasmSha256:expected,matches:expected === null ? null : observed === expected,instanceLiveUntilLedger:instance?.liveUntilLedgerSeq ?? null};
}
const stringify = (value: unknown) => typeof value === 'bigint' ? value.toString() : value;

// 1. The configured VELTRIXAE AMM.
const network = await server.getNetwork(), health = await server.getHealth();
if (network.passphrase !== Networks.TESTNET) throw new Error('Refusing to collect evidence: RPC is not Stellar Testnet');
const d = chain.manifest.soroswap;
if (!d) throw new Error('No AMM is configured');
const [factory,router] = [await codeHash(d.factory,d.factoryWasmHash),await codeHash(d.router,d.routerWasmHash)];
const pairCode = createHash('sha256').update(await server.getContractWasmByHash(Buffer.from(d.pairWasmHash,'hex'))).digest('hex');
const pairCodeEntry = (await server.getLedgerEntries(xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({hash:Buffer.from(d.pairWasmHash,'hex') as never})))).entries[0];

// 2. Recorded deployment receipts, checked against the chain while RPC retention still covers them.
const record = await json('docs/evidence/contracts-testnet-deployment-2026-11-02.json');
const completion = await json('docs/evidence/contracts-testnet-completion-2026-11-02.json');
const receipts = [];
for (const {operation,txHash} of completion.receipts as {operation: string; txHash: string}[]) {
  const tx = await server.getTransaction(txHash);
  receipts.push({operation,hash:txHash,status:tx.status,ledger:tx.status === 'NOT_FOUND' ? null : tx.ledger});
}

// 3. Public Soroswap Testnet contracts, used only as a reference for funded pools. Never active configuration.
const candidate = await json('docs/evidence/soroswap-core-testnet-candidate.json');
const publicFactory: string = candidate.ids.factory, publicRouter: string = candidate.ids.router;
const publicPoolCount = Number((await read(publicFactory,'all_pairs_length')).value);
const samplePool = (await read(publicFactory,'all_pairs',[nativeToScVal(0,{type:'u32'})])).value as string;
const [token0,token1,reserves] = await Promise.all(['token_0','token_1','get_reserves'].map(method => read(samplePool,method))) as [{value:string},{value:string},{value:[bigint,bigint];ledger:number}];

// 4. Local integer math against the deployed public router. Same-ledger trials are the only strict comparisons.
const parity = [];
for (let i = 0; i < trials; i++) {
  const exactIn = i % 3 !== 2, amount = [10n,12345n,1000000n,987654321n][i % 4]!;
  const [fresh,result] = await Promise.all([
    read(samplePool,'get_reserves') as Promise<{value:[bigint,bigint];ledger:number}>,
    read(publicRouter,exactIn?'router_get_amounts_out':'router_get_amounts_in',[nativeToScVal(amount,{type:'i128'}),nativeToScVal([token0.value,token1.value].map(p => new Address(p).toScVal()))]),
  ]);
  const routerAmounts = result.value as bigint[];
  const local = exactIn ? output(amount,fresh.value[0],fresh.value[1]) : input(amount,fresh.value[0],fresh.value[1]);
  const router = exactIn ? routerAmounts[1]! : routerAmounts[0]!;
  parity.push({kind:exactIn?'exactIn':'exactOut',amount:amount.toString(),local:local.toString(),router:router.toString(),match:local === router,sameLedger:fresh.ledger === result.ledger});
}

// 5. The real quote path over real RPC, with discovery narrowed to one funded public pool.
const transport = new StellarTransport(env.RPC_URL,env.RPC_TIMEOUT_MS,env.RPC_CONCURRENCY);
const narrowed: Transport = {
  network:() => transport.network(), latest:() => transport.latest(), wasm:id => transport.wasm(id), codeHashes:(ids,expected) => transport.codeHashes(ids,expected), transaction:hash => transport.transaction(hash),
  read:async (id,method,args) => {
    if (id === publicFactory && method === 'all_pairs_length') return {value:1,ledger:0};
    if (id === publicFactory && method === 'all_pairs') return {value:samplePool,ledger:0};
    return transport.read(id,method,args);
  },
};
const publicManifest: Manifest = manifestSchema.parse({network:'testnet',soroswap:{factory:publicFactory,router:publicRouter,factoryWasmHash:candidate.hashes.factory,routerWasmHash:candidate.hashes.router,pairWasmHash:candidate.hashes.pair},veltrixae:null,assets:[]});
const quoting = new StellarChain(publicManifest,narrowed,{timeoutMs:env.DISCOVERY_TIMEOUT_MS});
const outcomes: Record<string,number> = {}, durations: number[] = [];
for (let i = 0; i < trials; i++) {
  const started = Date.now();
  let outcome = 'OK';
  try {
    const estimate = quote(quoteRequest.parse({tokenIn:token0.value,tokenOut:token1.value,amount:'1000000',kind:i % 2 ? 'exactOut' : 'exactIn'}),await quoting.snapshot());
    await quoting.validateQuote(estimate);
  } catch (error) { outcome = code(error); }
  outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  durations.push(Date.now() - started);
}
durations.sort((a,b) => a - b);

const evidence = {
  checkedAt:new Date().toISOString(),
  method:'Read-only: getNetwork, getHealth, getLedgerEntries, simulateTransaction, getTransaction. No key was used; nothing was signed or submitted.',
  rpc:{url:env.RPC_URL,passphrase:network.passphrase,protocolVersion:network.protocolVersion,latestLedger:health.latestLedger,oldestLedger:health.oldestLedger},
  veltrixaeAmm:{
    sourceCommit:record.git_commit,factory,router,
    pairCode:{expectedWasmSha256:d.pairWasmHash,observedWasmSha256:pairCode,matches:pairCode === d.pairWasmHash,liveUntilLedger:pairCodeEntry?.liveUntilLedgerSeq ?? null,note:'Code is uploaded; no pair instance exists to confirm it runs.'},
    routerFactoryLink:(await read(d.router,'get_factory')).value === d.factory,
    feeToSetter:(await read(d.factory,'fee_to_setter')).value,
    feesEnabled:(await read(d.factory,'fees_enabled')).value,
    poolCount:Number((await read(d.factory,'all_pairs_length')).value),
    receipts,
  },
  readiness:await chain.readiness(),
  publicSoroswapReference:{
    note:'Soroswap-operated Testnet contracts: a reference for funded-pool behaviour. This is not VELTRIXAE liquidity and is not active configuration.',
    factory:publicFactory,router:publicRouter,poolCount:publicPoolCount,
    samplePool:{id:samplePool,token0:token0.value,token1:token1.value,reserve0:reserves.value[0].toString(),reserve1:reserves.value[1].toString(),ledger:reserves.ledger},
    quoteMathParity:{trials,matches:parity.filter(p => p.match).length,sameLedger:parity.filter(p => p.sameLedger).length,sameLedgerMatches:parity.filter(p => p.sameLedger && p.match).length,results:parity},
    endToEndQuoteAttempts:{trials,outcomes,medianMs:durations[durations.length >> 1],maxMs:durations.at(-1),note:'Measured from this client against the public RPC; expect latency to vary.'},
  },
};
const text = JSON.stringify(evidence,(_,value) => stringify(value),2) + '\n';
if (values.output) await writeFile(values.output,text,{flag:'wx'});
console.log(text);

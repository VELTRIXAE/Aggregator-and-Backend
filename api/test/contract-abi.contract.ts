import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {contract, StrKey} from '@stellar/stellar-sdk';
import {StellarChain, type Transport} from '../src/chain.js';
import {manifestSchema, quoteRequest} from '../src/domain.js';
import {quote} from '../src/routing.js';
import {A,B,address,snapshot} from './fixtures.js';

// Requires npm run test:contracts/build-contracts first. Never substitutes fixture WASM.
const wasm=await readFile(new URL('../../upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/soroswap_aggregator.optimized.wasm',import.meta.url));
const spec=contract.Spec.fromWasm(wasm);
test('unsigned exact-input/output operations match the actual optimized Rust contract spec',()=>{
 const aggregator=address(12);
 const manifest=manifestSchema.parse({network:'testnet',soroswap:null,veltrixae:{aggregator,aggregatorWasmHash:'0'.repeat(64)},assets:[]});
 // This test checks encoding only, without pretending that the manifest is deployed or verified.
 const chain=new StellarChain(manifest,{} as Transport);
 const to=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,9));
 for(const kind of ['exactIn','exactOut'] as const){
  const q=quote(quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000',kind}),snapshot());
  const invoke=chain.swapOperation(q,to).body.invokeHostFunctionOp.hostFunction.invokeContract;
  const method=kind==='exactIn'?'swap_exact_tokens_for_tokens':'swap_tokens_for_exact_tokens';
  assert.equal(invoke.functionName.toString(),method);
  const expected=spec.funcArgsToScVals(method,{
   token_in:A,token_out:B,
   ...(kind==='exactIn'?{amount_in:BigInt(q.amountIn),amount_out_min:BigInt(q.minimumReceived)}:{amount_out:BigInt(q.amountOut),amount_in_max:BigInt(q.maximumInput)}),
   distribution:[{protocol_id:0,path:q.selectedRoute.path,parts:1,bytes:undefined}],
   to,deadline:BigInt(Math.floor(q.expiresAt/1000)),
  });
  assert.deepEqual(invoke.args.map(arg=>arg.toXDR('base64')),expected.map(arg=>arg.toXDR('base64')));
 }
});

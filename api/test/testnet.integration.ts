import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../src/config.js';
import {quoteRequest} from '../src/domain.js';
import {quote} from '../src/routing.js';
const enabled=process.env.RUN_TESTNET_TESTS==='1';
test('live Testnet RPC network and ledger', {skip:!enabled},async()=>{
 const {chain}=await loadConfig();const status=await chain.status();assert.equal(status.network,'testnet');assert.ok(status.sequence>0);
});
test('live configured factory pools, metadata and simulated router quotation', {skip:!enabled||!process.env.TEST_TOKEN_IN||!process.env.TEST_TOKEN_OUT},async()=>{
 const {chain}=await loadConfig();assert.ok(chain.manifest.soroswap,'Configure verified deployment manifest');
 await chain.verifyDeployment();const snapshot=await chain.snapshot();assert.ok(snapshot.pools.length>0);assert.ok((await chain.tokens()).length>0);
 const result=quote(quoteRequest.parse({tokenIn:process.env.TEST_TOKEN_IN,tokenOut:process.env.TEST_TOKEN_OUT,amount:process.env.TEST_AMOUNT??'10000'}),snapshot);
 await chain.validateQuote(result);assert.ok(BigInt(result.amountOut)>0n);
});

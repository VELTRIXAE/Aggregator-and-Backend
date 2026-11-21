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

test('live configured AMM deployment and complete pool discovery, including an empty factory', {skip:!enabled},async()=>{
 const {chain}=await loadConfig();
 assert.ok(chain.manifest.soroswap,'Configure the real reviewed Testnet AMM');
 assert.equal((await chain.verifyDeployment()).verified,true);
 const snapshot=await chain.snapshot();
 assert.ok(snapshot.ledger>0);assert.ok(Date.now()-snapshot.observedAt<15000);
 assert.equal(new Set(snapshot.pools.map(p=>p.id)).size,snapshot.pools.length);
 for(const pool of snapshot.pools)assert.equal(pool.ledger,snapshot.ledger);
});

test('live readiness keeps mainnet disabled and reports observed gates without inventing liquidity', {skip:!enabled},async()=>{
 const {chain}=await loadConfig();
 const readiness=await chain.readiness();
 assert.equal(readiness.mainnetEnabled,false);assert.equal(readiness.submitsTransactions,false);assert.equal(readiness.networkVerified,true);
 assert.equal(readiness.deployment.status,'verified',String(readiness.deployment.code));
 if(readiness.liquidity.status==='empty'){assert.equal(readiness.quotesAvailable,false);assert.ok(readiness.blockers.includes('NO_POOLS'));}
 if(!chain.manifest.veltrixae){assert.equal(readiness.swapPreparationAvailable,false);assert.ok(readiness.blockers.includes('AGGREGATOR_NOT_DEPLOYED'));}
});

const demoEnabled=enabled&&process.env.TESTNET_SWAP_DEMO==='1';
test('live funded Testnet pool quote, swap preparation and confirmed swap receipt', {skip:!demoEnabled},async()=>{
 const tokenIn=process.env.TEST_TOKEN_IN;const tokenOut=process.env.TEST_TOKEN_OUT;const swapHash=process.env.TESTNET_SWAP_HASH;
 assert.ok(tokenIn,'Set TEST_TOKEN_IN to a real Testnet token contract ID');
 assert.ok(tokenOut,'Set TEST_TOKEN_OUT to a real Testnet token contract ID');
 assert.ok(swapHash,'Set TESTNET_SWAP_HASH to a confirmed Testnet swap transaction hash');
 assert.notEqual(tokenIn,tokenOut,'TEST_TOKEN_IN and TEST_TOKEN_OUT must differ');
 const {chain}=await loadConfig();
 assert.equal(chain.network,'testnet','Refusing to run swap demo against a non-Testnet network');
 assert.ok(chain.manifest.soroswap,'Configure the real reviewed Testnet AMM');
 assert.equal((await chain.verifyDeployment()).verified,true,'Configured Testnet deployment did not verify');
 const snapshot=await chain.snapshot();
 assert.ok(snapshot.pools.length>0,'No pools discovered on the configured Testnet factory; fund a real pool first');
 assert.ok((await chain.tokens()).length>0,'No token metadata discovered on the configured Testnet deployment');
 const result=quote(quoteRequest.parse({tokenIn,tokenOut,amount:process.env.TEST_AMOUNT??'10000'}),snapshot);
 assert.ok(BigInt(result.amountOut)>0n,'Quote produced a non-positive amountOut');
 await chain.validateQuote(result);
 const prepared=await chain.prepareSwap(result);
 assert.ok(prepared,'Swap preparation returned no result');
 assert.equal(prepared.submitsTransactions,false,'Swap preparation must not submit transactions');
 assert.equal(prepared.signed,false,'Swap preparation must not sign transactions');
 const receipt=await chain.transaction(swapHash);
 assert.ok(receipt,'chain.transaction returned no receipt for TESTNET_SWAP_HASH');
 assert.equal(receipt.hash,swapHash,'Receipt hash does not match the supplied confirmed swap hash');
 assert.equal(receipt.status,'success','Supplied swap transaction is not confirmed successful on Testnet');
 assert.ok(receipt.ledger>0,'Receipt is missing a confirmed ledger sequence');
 assert.ok(receipt.ledger<=snapshot.ledger,'Receipt ledger is ahead of the observed ledger');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEnvironment} from '../src/config.js';
test('environment supplies safe defaults and bounded operator workload configuration',()=>{
 const {env,origins}=parseEnvironment({});
 assert.equal(env.MAX_DISCOVERY_POOLS,1000);assert.equal(env.RPC_CONCURRENCY,5);assert.deepEqual(origins,[]);
 for(const values of [{RPC_CONCURRENCY:'11'},{MAX_DISCOVERY_POOLS:'1001'},{MAX_DISCOVERY_POOLS:'0'},{DISCOVERY_PAGE_SIZE:'21'},{DISCOVERY_TIMEOUT_MS:'15001'},{RPC_TIMEOUT_MS:'0'},{PORT:'no'},{CORS_ORIGINS:'*'},{CORS_ORIGINS:'https://example.com/path'}]) assert.throws(()=>parseEnvironment(values));
 assert.deepEqual(parseEnvironment({CORS_ORIGINS:'https://frontend.example,http://localhost:5173'}).origins,['https://frontend.example','http://localhost:5173']);
});
test('RPC URL rejects credential material and insecure transport before creating a client',()=>{
 for(const RPC_URL of ['http://rpc.example','https://user:password@rpc.example','https://rpc.example?apiKey=secret','https://rpc.example#secret'])assert.throws(()=>parseEnvironment({RPC_URL}));
});

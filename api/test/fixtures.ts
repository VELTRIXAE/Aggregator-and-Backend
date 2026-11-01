import { StrKey } from '@stellar/stellar-sdk';
import { ServiceError } from '../src/domain.js';
import type { Chain, Pool, Quote, Snapshot } from '../src/domain.js';
export const address = (n: number) => StrKey.encodeContract(Buffer.alloc(32,n));
export const A = address(1), B = address(2), C = address(3);
export const pool = (id=address(4), token0=A, token1=B, reserve0='1000000',reserve1='2000000'):Pool => ({id,protocol:'Soroswap',token0,token1,reserve0,reserve1,feeBps:30,ledger:123,observedAt:Date.now()});
export const snapshot = (pools=[pool()]):Snapshot => ({pools,ledger:123,observedAt:Date.now()});
export const fakeChain = (overrides: Partial<Chain> = {}): Chain => ({snapshot:async()=>snapshot(),tokens:async()=>[],status:async()=>({network:'testnet',sequence:123}),transaction:async hash=>({hash,status:'NOT_FOUND',finalized:false}),validateQuote:async(_:Quote)=>{},prepareSwap:async()=>{throw new ServiceError('NOT_CONFIGURED','Test fixture has no swap deployment');},...overrides});

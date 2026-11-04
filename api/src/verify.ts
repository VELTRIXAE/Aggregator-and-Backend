import { loadConfig } from './config.js';
import { ServiceError } from './domain.js';
// Read-only. Exit status gates scripts/deploy-testnet.sh: unverified or unobservable state must stop it.
const {chain} = await loadConfig();
try {
  console.log(JSON.stringify(await chain.verifyDeployment(),null,2));
  const readiness = await chain.readiness();
  console.log(JSON.stringify(readiness,null,2));
  if (readiness.deployment.status !== 'verified' || readiness.liquidity.code !== null) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({verified:false,code:error instanceof ServiceError ? error.code : 'UNEXPECTED_ERROR',message:error instanceof ServiceError ? error.message : 'Verification failed'},null,2));
  process.exitCode = 1;
}

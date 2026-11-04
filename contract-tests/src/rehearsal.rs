//! Local rehearsal of the Testnet plan in the Soroban test host. Nothing here touches a network.
//!
//! It runs the upstream aggregator against the exact Factory, Router and Pair WASM deployed on Testnet, which
//! scripts/test-contracts.sh extracts from docs/evidence and checks against config/testnet.json. Passing shows these
//! binaries work together. It is not evidence of a live pool or swap, and token amounts are test fixtures.
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, Vec,
};

mod aggregator {
    soroban_sdk::contractimport!(file = "../upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/soroswap_aggregator.optimized.wasm");
}
mod factory {
    soroban_sdk::contractimport!(file = "../upstream/soroswap/contracts/target/veltrixae-testnet-wasm/veltrixae_factory.optimized.wasm");
}
mod router {
    soroban_sdk::contractimport!(file = "../upstream/soroswap/contracts/target/veltrixae-testnet-wasm/veltrixae_router.optimized.wasm");
}
mod pair {
    soroban_sdk::contractimport!(file = "../upstream/soroswap/contracts/target/veltrixae-testnet-wasm/veltrixae_pair.optimized.wasm");
}

const SEED_A: i128 = 1_000_000_000;
const SEED_B: i128 = 2_000_000_000;
const DEADLINE: u64 = 10_000;

// The same integer formulas as api/src/routing.ts, so these tests also tie the backend's math to the deployed router.
fn amount_out(input: i128, reserve_in: i128, reserve_out: i128) -> i128 {
    let adjusted = input - (input * 3 + 999) / 1000;
    adjusted * reserve_out / (reserve_in + adjusted)
}
fn amount_in(output: i128, reserve_in: i128, reserve_out: i128) -> i128 {
    let numerator = reserve_in * output * 1000;
    let denominator = (reserve_out - output) * 997;
    (numerator + denominator - 1) / denominator + 1
}

struct System<'a> {
    env: Env,
    factory: factory::Client<'a>,
    router: router::Client<'a>,
    aggregator: aggregator::Client<'a>,
    token_a: Address,
    token_b: Address,
    trader: Address,
    provider: Address,
}

fn deploy<'a>() -> System<'a> {
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    env.mock_all_auths();
    let setter = Address::generate(&env);
    let factory_id = env.register(factory::WASM, ());
    let factory = factory::Client::new(&env, &factory_id);
    factory.initialize(&setter, &env.deployer().upload_contract_wasm(pair::WASM));
    let router_id = env.register(router::WASM, ());
    let router = router::Client::new(&env, &router_id);
    router.initialize(&factory_id);

    let issuer = Address::generate(&env);
    let token_a = env.register_stellar_asset_contract_v2(issuer.clone()).address();
    let token_b = env.register_stellar_asset_contract_v2(issuer).address();
    let (provider, trader) = (Address::generate(&env), Address::generate(&env));
    for (token, who, amount) in [
        (&token_a, &provider, SEED_A),
        (&token_b, &provider, SEED_B),
        (&token_a, &trader, 100_000_000),
        (&token_b, &trader, 100_000_000),
    ] {
        StellarAssetClient::new(&env, token).mint(who, &amount);
    }

    let aggregator_id = env.register(aggregator::WASM, ());
    let aggregator = aggregator::Client::new(&env, &aggregator_id);
    let adapters = vec![&env, aggregator::Adapter { protocol_id: aggregator::Protocol::Soroswap, router: router_id, paused: false }];
    aggregator.initialize(&Address::generate(&env), &adapters);
    System { env, factory, router, aggregator, token_a, token_b, trader, provider }
}

impl System<'_> {
    fn seed(&self) -> Address {
        self.router.add_liquidity(&self.token_a, &self.token_b, &SEED_A, &SEED_B, &SEED_A, &SEED_B, &self.provider, &DEADLINE);
        self.factory.get_pair(&self.token_a, &self.token_b)
    }
    fn balance(&self, token: &Address) -> i128 {
        TokenClient::new(&self.env, token).balance(&self.trader)
    }
    fn route(&self) -> Vec<aggregator::DexDistribution> {
        vec![&self.env, aggregator::DexDistribution {
            protocol_id: aggregator::Protocol::Soroswap,
            path: vec![&self.env, self.token_a.clone(), self.token_b.clone()],
            parts: 1,
            bytes: None,
        }]
    }
    fn path(&self) -> Vec<Address> {
        vec![&self.env, self.token_a.clone(), self.token_b.clone()]
    }
}

#[test]
fn first_pool_is_created_and_funded_through_the_router() {
    let s = deploy();
    assert_eq!(s.factory.all_pairs_length(), 0);
    let id = s.seed();
    assert_eq!(s.factory.all_pairs_length(), 1);
    assert_eq!(s.factory.all_pairs(&0), id);
    let pool = pair::Client::new(&s.env, &id);
    assert_eq!(pool.factory(), s.factory.address);
    let (reserve_0, reserve_1) = pool.get_reserves();
    let expected = if pool.token_0() == s.token_a { (SEED_A, SEED_B) } else { (SEED_B, SEED_A) };
    assert_eq!((reserve_0, reserve_1), expected);
    // 1000 shares stay locked, as in the deployed pair.
    assert_eq!(pool.balance(&s.provider), 1_414_213_562 - 1000);
}

#[test]
fn aggregator_swaps_exact_input_at_the_backend_quote() {
    let s = deploy();
    s.seed();
    let input = 1_000_000;
    let expected = amount_out(input, SEED_A, SEED_B);
    assert_eq!(s.router.router_get_amounts_out(&input, &s.path()), vec![&s.env, input, expected]);
    let (a, b) = (s.balance(&s.token_a), s.balance(&s.token_b));
    s.aggregator.swap_exact_tokens_for_tokens(&s.token_a, &s.token_b, &input, &expected, &s.route(), &s.trader, &DEADLINE);
    assert_eq!(s.balance(&s.token_a), a - input);
    assert_eq!(s.balance(&s.token_b), b + expected);
}

#[test]
fn aggregator_swaps_exact_output_at_the_backend_quote() {
    let s = deploy();
    s.seed();
    let output = 1_000_000;
    let expected = amount_in(output, SEED_A, SEED_B);
    assert_eq!(s.router.router_get_amounts_in(&output, &s.path()), vec![&s.env, expected, output]);
    let (a, b) = (s.balance(&s.token_a), s.balance(&s.token_b));
    s.aggregator.swap_tokens_for_exact_tokens(&s.token_a, &s.token_b, &output, &expected, &s.route(), &s.trader, &DEADLINE);
    assert_eq!(s.balance(&s.token_a), a - expected);
    assert_eq!(s.balance(&s.token_b), b + output);
}

#[test]
fn swaps_fail_without_moving_funds_when_a_limit_is_not_met() {
    let s = deploy();
    s.seed();
    let input = 1_000_000;
    let quoted = amount_out(input, SEED_A, SEED_B);
    let (a, b) = (s.balance(&s.token_a), s.balance(&s.token_b));
    // Minimum output one base unit above what the pool can pay.
    assert!(s.aggregator.try_swap_exact_tokens_for_tokens(&s.token_a, &s.token_b, &input, &(quoted + 1), &s.route(), &s.trader, &DEADLINE).is_err());
    // Maximum input one base unit below what the pool requires.
    let required = amount_in(input, SEED_A, SEED_B);
    assert!(s.aggregator.try_swap_tokens_for_exact_tokens(&s.token_a, &s.token_b, &input, &(required - 1), &s.route(), &s.trader, &DEADLINE).is_err());
    // Expired deadline.
    s.env.ledger().set_timestamp(DEADLINE + 1);
    assert!(s.aggregator.try_swap_exact_tokens_for_tokens(&s.token_a, &s.token_b, &input, &quoted, &s.route(), &s.trader, &DEADLINE).is_err());
    assert_eq!((s.balance(&s.token_a), s.balance(&s.token_b)), (a, b));
}

#[test]
fn swaps_require_the_wallet_authorization_of_the_trader() {
    let s = deploy();
    s.seed();
    let input = 1_000_000;
    let quoted = amount_out(input, SEED_A, SEED_B);
    let (a, b) = (s.balance(&s.token_a), s.balance(&s.token_b));
    s.env.mock_auths(&[]);
    assert!(s.aggregator.try_swap_exact_tokens_for_tokens(&s.token_a, &s.token_b, &input, &quoted, &s.route(), &s.trader, &DEADLINE).is_err());
    assert_eq!((s.balance(&s.token_a), s.balance(&s.token_b)), (a, b));
}

#[test]
fn a_paused_adapter_stops_swaps() {
    let s = deploy();
    s.seed();
    s.aggregator.set_pause(&aggregator::Protocol::Soroswap, &true);
    let input = 1_000_000;
    let quoted = amount_out(input, SEED_A, SEED_B);
    assert!(s.aggregator.try_swap_exact_tokens_for_tokens(&s.token_a, &s.token_b, &input, &quoted, &s.route(), &s.trader, &DEADLINE).is_err());
}

#[test]
fn an_empty_factory_has_no_route() {
    let s = deploy();
    assert!(s.router.try_router_get_amounts_out(&1_000_000, &s.path()).is_err());
    assert!(s.aggregator.try_swap_exact_tokens_for_tokens(&s.token_a, &s.token_b, &1_000_000, &1, &s.route(), &s.trader, &DEADLINE).is_err());
}

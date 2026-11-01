//! VELTRIXAE boundary tests against the preserved, compiled upstream aggregator.
#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, vec, Address, Env, Vec};
    mod aggregator {
        soroban_sdk::contractimport!(file = "../upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/soroswap_aggregator.optimized.wasm");
    }

    #[test]
    fn initialization_requires_admin_authorization() {
        let env = Env::default();
        let id = env.register(aggregator::WASM, ());
        let client = aggregator::Client::new(&env, &id);
        let admin = Address::generate(&env);
        assert!(client.try_initialize(&admin, &Vec::new(&env)).is_err());
    }

    #[test]
    fn unauthorized_admin_change_does_not_mutate_state() {
        let env = Env::default();
        let id = env.register(aggregator::WASM, ());
        let client = aggregator::Client::new(&env, &id);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.initialize(&admin, &Vec::new(&env));
        env.mock_auths(&[]);
        assert!(client.try_set_admin(&Address::generate(&env)).is_err());
        assert_eq!(client.get_admin(), admin);
    }

    #[test]
    fn swaps_require_recipient_authorization() {
        let env = Env::default();
        let id = env.register(aggregator::WASM, ());
        let client = aggregator::Client::new(&env, &id);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.initialize(&admin, &Vec::new(&env));
        env.mock_auths(&[]);
        let token_in = Address::generate(&env);
        let token_out = Address::generate(&env);
        let recipient = Address::generate(&env);
        let distribution = vec![
            &env,
            aggregator::DexDistribution {
                protocol_id: aggregator::Protocol::Soroswap,
                path: vec![&env, token_in.clone(), token_out.clone()],
                parts: 1,
                bytes: None,
            },
        ];
        assert!(client
            .try_swap_exact_tokens_for_tokens(
                &token_in,
                &token_out,
                &100,
                &1,
                &distribution,
                &recipient,
                &1000
            )
            .is_err());
        assert!(client
            .try_swap_tokens_for_exact_tokens(
                &token_in,
                &token_out,
                &100,
                &1000,
                &distribution,
                &recipient,
                &1000
            )
            .is_err());
    }

    #[test]
    fn rejects_invalid_amounts_paths_and_distribution_before_protocol_invocation() {
        let env = Env::default();
        let id = env.register(aggregator::WASM, ());
        let client = aggregator::Client::new(&env, &id);
        env.mock_all_auths();
        client.initialize(&Address::generate(&env), &Vec::new(&env));
        let token_in = Address::generate(&env);
        let token_out = Address::generate(&env);
        let recipient = Address::generate(&env);
        let mut route = aggregator::DexDistribution {
            protocol_id: aggregator::Protocol::Soroswap,
            path: vec![&env, token_in.clone(), token_out.clone()],
            parts: 1,
            bytes: None,
        };
        for amount in [-10, 0, 9] {
            assert_eq!(
                client.try_swap_exact_tokens_for_tokens(
                    &token_in,
                    &token_out,
                    &amount,
                    &1,
                    &vec![&env, route.clone()],
                    &recipient,
                    &1000
                ),
                Err(Ok(aggregator::AggregatorError::NegibleAmount))
            );
        }
        route.path = vec![&env, token_out.clone(), token_in.clone()];
        assert_eq!(
            client.try_swap_exact_tokens_for_tokens(
                &token_in,
                &token_out,
                &100,
                &1,
                &vec![&env, route.clone()],
                &recipient,
                &1000
            ),
            Err(Ok(aggregator::AggregatorError::InvalidPath))
        );
        route.parts = 0;
        assert_eq!(
            client.try_swap_exact_tokens_for_tokens(
                &token_in,
                &token_out,
                &100,
                &1,
                &vec![&env, route],
                &recipient,
                &1000
            ),
            Err(Ok(aggregator::AggregatorError::ZeroDistributionPart))
        );
    }
}

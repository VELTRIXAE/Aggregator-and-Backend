# Separate the ABI name from the pool operator in API responses

## Problem

`Pool.protocol` and `Route.protocol` are always `'Soroswap'`, and the manifest slot is called `soroswap`. In the configured deployment, those pools would be on the VELTRIXAE-operated AMM, which is derived from Soroswap Core and shares its ABI. Consumers could read this as Soroswap operating the pool. The label is about interface compatibility, and neither attribution nor operator should be left to inference.

## Scope

Add explicit fields, for example `abi: 'soroswap'` and `operator: 'veltrixae'`, and plan the change for existing consumers. Keep the attribution to Soroswap in documentation.

## Acceptance criteria

- API, client types, OpenAPI and docs updated together.
- A migration note for frontend consumers.

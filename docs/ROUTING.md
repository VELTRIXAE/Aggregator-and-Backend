# Routing and quotations

Requests use checksummed Soroban token contract IDs and decimal integer strings in token base units. Aggregator minimum input/output request amount is 10 base units. i128 bounds apply; token display decimals never enter amount arithmetic. Slippage is integer basis points from 0 to 5000, default 50. Search explores at most 10000 states, at most three hops, forbids token/pool cycles, returns at most 20 candidates and selects one route.

For exact input, pinned Soroswap charges `ceil(input * 3 / 1000)` and computes `floor((input-fee)*reserveOut/(reserveIn+input-fee))`. Exact output uses `ceil(reserveIn*out*1000/((reserveOut-out)*997))+1`, matching the pinned library rather than a generic AMM approximation. Intermediates must fit contract i128 limits.

Exact-input routes sort by descending output; exact-output routes sort by ascending required input. Ties prefer fewer hops. Overflow, zero-rounded and insufficient-reserve paths are discarded. No surviving path yields NO_LIQUIDITY. The selected route is compared to router simulation before the API returns it.

Minimum received for exact input is `floor(output*(10000-slippageBps)/10000)`. Maximum input for exact output is `ceil(input*(10000+slippageBps)/10000)`. Exact-output minimum remains the requested output. Limits must fit i128. Integer fees are returned per hop in that hop's input token and must not be summed across unlike tokens.

Price impact compares the route's actual output against its fee-free infinitesimal spot ratio using integer rational arithmetic; it includes fees. It is not an oracle price. Quotes expire 15 seconds after reserve observation, carry their ledger and always have executable=false. Network/resource fees are null until full transaction simulation. Estimates do not promise globally best execution. The contract and final wallet simulation must enforce deadline, authorization and slippage.

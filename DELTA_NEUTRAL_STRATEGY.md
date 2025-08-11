# Design Document: Delta-Neutral Stablecoin Strategy

## Executive Summary

**Objective:** This document outlines the architecture for an advanced stablecoin model where the minter is safeguarded from the price risk of their volatile collateral. This design is inspired by the "delta-neutral" hedging strategy used by protocols like Ethena.

**Recommended Architecture: A "Delta-Neutral" CDP Model**
The proposed architecture combines a spot long position on a volatile asset within Aave with a corresponding 1x short position on a decentralized perpetuals exchange. This structure effectively neutralizes the price risk ("delta") of the collateral, creating a stable-valued, yield-bearing asset to back the new stablecoin.

**Key Innovation & Trade-offs:**
*   **Innovation:** This model transforms volatile assets like `WETH` or `stETH` into a suitable backing for a stablecoin, enabling much higher capital efficiency (LTV >90%) and offering users a native yield on their position.
*   **Trade-off:** The primary risk shifts from the market risk of the collateral's price to more complex, operational risks such as managing funding rates, basis risk, and the counterparty risk of the integrated derivatives exchange.

**Core Components:**
*   A `DeltaNeutralVault` for user accounting and core logic.
*   Modular `Adapter` contracts for integrating with Aave and a chosen derivatives protocol.
*   A sophisticated `HedgingManager` contract, operated by keeper bots, to actively manage the short position.

**Conclusion:** This design represents the frontier of stablecoin mechanics. It offers unparalleled capital efficiency and a built-in yield for users but introduces significant complexity and new risk vectors that require a highly robust and specialized risk management framework.

---

## 1. The Core "Delta-Neutral" Strategy

### 1.1. Combining Long & Short Positions
The strategy is to hedge the price risk of a spot asset by holding an equal, offsetting derivatives position.
*   **The "Long" Position:** A user deposits `1 WETH` into the `DeltaNeutralVault`, which is then supplied to Aave to get `1 aWETH`. This is a spot long position that also earns the Aave supply APY.
*   **The "Short" Position:** The vault simultaneously opens a `1x short WETH` perpetual futures position on a decentralized exchange.
*   **The Effect:** When the price of `WETH` falls, the value of the `aWETH` decreases, but the value of the short position increases by an equal amount, keeping the total collateral value stable. The reverse is true when the price rises.

### 1.2. Implications for Liquidation Risk and Capital Efficiency
*   **Reduced Liquidation Risk:** Traditional liquidations due to collateral price drops are eliminated.
*   **Higher LTV:** Because the collateral value is stable, the LTV can be safely increased to 90% or higher, allowing users to unlock more liquidity.

---

## 2. Proposed Technical Stack

A modular architecture is required to manage this complexity.

### 2.1. Core Component: `DeltaNeutralVault.sol`
*   The user-facing contract for deposits, withdrawals, and accounting of user debt. It does not hold assets directly but orchestrates the adapters.

### 2.2. Integration Layer: `AaveAdapter.sol` & `DerivativesAdapter.sol`
*   These contracts abstract the logic of interacting with external protocols.
*   The `AaveAdapter` supplies collateral to the Aave Pool and holds the `aTokens`.
*   The `DerivativesAdapter` contains the logic for opening, closing, and managing the margin of the short position on a specific derivatives exchange (e.g., GMX).

### 2.3. Operational Component: `HedgingManager.sol`
*   A privileged contract operated by keeper bots.
*   Its primary job is to run `rebalanceHedge()` periodically, ensuring the size of the short position always matches the amount of spot collateral. It also manages margin and monitors funding rates.

---

## 3. Yield and Cost Dynamics

The sustainability of the system depends on the net APY from its operations.

### 3.1. Sources of Yield (Income)
*   **Staking Yield:** From using a Liquid Staked Token like `stETH` as the base collateral (~3-4% APR).
*   **Lending Yield:** The Aave supply APY on the deposited collateral (~0.5-2.5% APR).
*   **Funding Rate Yield:** Historically positive funding rates paid from long to short position holders on perpetuals exchanges (highly variable, but historically averages positive).

### 3.2. Sources of Cost (Expenses)
*   **Negative Funding Rates:** The primary risk. If shorts must pay longs, this becomes a direct cost to the system.
*   **Trading Fees:** Small fees incurred on the derivatives exchange when rebalancing the hedge.
*   **Protocol Stability Fee:** The fee users pay to mint the stablecoin, which funds the treasury.

### 3.3. The Net Economic Equation
The system is sustainable if `(Staking + Lending + Funding Yield) > (Hedging Costs)`. The stability fee is set by governance to capture a portion of this net yield for the protocol's treasury.

---

## 4. Specialized Risk Management Framework

This model requires managing new, complex risks.

### 4.1. Funding Rate Risk
*   **Threat:** A sustained period of negative funding rates could drain the vault's value.
*   **Mitigation:** The treasury must act as a buffer. Real-time monitoring is required to alert governance to halt mints or even trigger a controlled wind-down of the system if rates become unsustainably negative.

### 4.2. Basis Risk
*   **Threat:** The futures price may not perfectly track the spot price, creating an imperfect hedge.
*   **Mitigation:** Only integrate with highly liquid derivatives venues with a history of low basis risk. Monitor the basis in real-time.

### 4.3. Derivatives Liquidation Risk
*   **Threat:** The short position itself could be liquidated by the derivatives exchange during extreme volatility.
*   **Mitigation:** The `HedgingManager` must be programmed to be conservative, always maintaining a healthy margin level far from the liquidation threshold.

### 4.4. Counterparty & Cascading Risk
*   **Threat:** The system relies on the security and uptime of Aave *and* a derivatives exchange. A failure in either could cause a cascading failure.
*   **Mitigation:** Rigorous due diligence on the chosen derivatives protocol is essential. In the long term, the system should diversify its hedge across multiple derivatives exchanges to minimize single-point-of-failure risk. A global emergency pause function is mandatory.

This concludes the design for the delta-neutral stablecoin strategy.

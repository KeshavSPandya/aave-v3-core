# Treasury Monetization & Yield Generation Strategy

## Executive Summary

**Objective:** This document outlines a secure, sustainable, and scalable strategy for managing the `aUSD` protocol's treasury. The goal is to transform the treasury from a passive holder of assets into a productive entity that generates yield, grows the protocol's surplus buffer, and enhances the overall resilience of the `aUSD` stablecoin.

**Core Principle:** The guiding principle is **risk-adjusted yield**. The treasury's primary function is to act as a backstop for the protocol. Therefore, all yield-generating activities must prioritize capital preservation and security over chasing the highest possible APY.

**Recommended Architecture:** A modular **"Vault and Strategy"** pattern is proposed. This architecture separates the core asset custody and accounting (in a central `TreasuryVault` contract) from the specific yield-generation logic (in separate, single-purpose `Strategy` contracts). This design is battle-tested, minimizes risk, and allows for secure and governable extensibility.

**Key Proposed Strategies:**
*   **For Stablecoins (`aUSD`, `USDC`):** The initial strategy focuses on providing liquidity to a Curve `aUSD/USDC` pool to deepen the `aUSD` peg, and lending on the core Aave V3 protocol for baseline, low-risk yield.
*   **For Volatile Assets (`WETH`):** The primary strategy is liquid staking (e.g., converting `WETH` to `stETH`) to earn Ethereum's native staking yield, one of the safest "real yields" in DeFi.

**Risk Management:** A multi-layered risk management framework is essential. It combines on-chain controls (like strategy-level capital limits), continuous off-chain monitoring (for market and protocol health), and a formal, transparent governance process for approving and managing all yield strategies.

**Conclusion:** This design allows the treasury to be both a robust safety module and a productive, yield-generating entity, contributing to the long-term health and decentralization of the `aUSD` protocol.

---

## 1. Treasury Revenue Streams

The treasury will receive a diversified basket of assets from three primary sources:

*   **1.1. Primary: Stability Fees:** This is the most reliable income stream. A 100% `reserveFactor` on the `aUSD` reserve directs all accrued stability fees (paid in `aUSD`) to the treasury.
*   **1.2. Secondary: Liquidation Penalties:** A portion of the collateral from each liquidation (`liquidationProtocolFee`) is sent to the treasury. This provides a counter-cyclical inflow of volatile assets (`WETH`, `WBTC`) during market stress.
*   **1.3. Tertiary: PSM Fees:** If a Peg Stability Module is implemented, small fees from swaps (e.g., in `USDC`) will provide a steady stream of external stablecoins.

---

## 2. Yield Generation Strategies

The following strategies are proposed, starting with the most conservative.

### 2.1. Strategy for Stablecoin Holdings (`aUSD`, `USDC`)
*   **Aave Lending:** The default, lowest-risk action. Supply `USDC` and other stablecoins to the main Aave V3 protocol to earn the base supply APY.
*   **Curve Liquidity Provision (Protocol-Owned Liquidity):** Provide liquidity to a core `aUSD/USDC` Curve pool. This not only earns trading fees and `CRV` rewards but also serves the critical function of deepening the `aUSD` peg.

### 2.2. Strategy for Volatile Holdings (`WETH`)
*   **Liquid Staking:** Convert `WETH` received from liquidations into `stETH` (via Lido) to earn Ethereum's staking yield. This makes the treasury's core volatile asset productive.
*   **Aave Lending:** As a default, any volatile asset without a specific approved strategy should be supplied to the Aave V3 protocol to earn its base yield.

### 2.3. Proposed Initial Allocation Framework
Governance should take a phased approach:
*   **Phase 1 (Guarded Launch):** 100% of all assets received are supplied to the Aave V3 protocol. No external protocol risk is taken.
*   **Phase 2 (Growth):** Begin diversifying. Allocate up to 50% of stablecoins to Curve LPing and up to 75% of `WETH` to liquid staking, based on governance-approved risk assessments.

---

## 3. Required Technical Stack

A modular "Vault and Strategy" architecture is recommended.

### 3.1. Core Component: `TreasuryVault.sol`
*   A central custodian contract that holds all treasury assets.
*   It maintains a whitelist of approved `Strategy` contracts and their capital limits.
*   All administrative functions are owned by Aave Governance and protected by a time-lock.

### 3.2. Modular Components: `Strategy` Contracts
*   Simple, single-purpose contracts that each implement a specific yield strategy for a single asset.
*   Examples: `AaveLendingStrategy.sol`, `CurveLPStrategy.sol`, `LidoStakingStrategy.sol`.
*   Each `Strategy` contract must be independently audited and approved by governance before it can be added to the `TreasuryVault`'s whitelist.

### 3.3. Governance & Control Flow
*   Governance maintains full control over which strategies are approved and how much capital is allocated to each.
*   This creates a secure and transparent process for managing treasury operations, where risk is explicitly approved and limited on-chain.

---

## 4. Risk Management Framework

A multi-layered framework is required to manage the risks of active treasury management.

### 4.1. Smart Contract Risk
*   **Threat:** A bug in an external protocol (e.g., Curve) where the treasury has deployed capital.
*   **Mitigation:** Only use blue-chip, heavily audited protocols. Enforce on-chain **capital allocation limits** for each strategy to contain the "blast radius" of any single failure. Diversify across multiple strategies.

### 4.2. Economic & Market Risk
*   **Threat:** Impermanent loss, de-pegging of an external stablecoin, or slashing on staked ETH.
*   **Mitigation:** Focus on highly correlated pairs for LPing. Use only the most reputable liquid staking providers. Implement **real-time off-chain monitoring** to detect market anomalies.

### 4.3. Governance & Operational Risk
*   **Threat:** A malicious or poorly researched governance proposal.
*   **Mitigation:** Establish a formal **Risk Council** to provide expert analysis on new strategy proposals. Require a significant **time-lock** on all critical actions. Use keeper networks to automate routine tasks like harvesting rewards. Grant a guardian multi-sig the power to trigger an **emergency withdrawal** from any strategy showing signs of distress.

This framework ensures that the pursuit of yield is always balanced against the primary goal of preserving the treasury's capital as a backstop for the `aUSD` stablecoin.

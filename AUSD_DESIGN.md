# Aave-Native Stablecoin (AUSD): Architecture & Implementation Plan

## Executive Summary

**Objective:** This document outlines a concrete architecture and implementation plan for launching a native Collateralized Debt Position (CDP) stablecoin, tentatively named `AUSD`, on the Aave V3 protocol. The goal is to create a capital-efficient, secure, and highly integrated stablecoin that leverages Aave's existing strengths.

**Recommended Architecture: Aave-Native Reserve + Facilitator Minting**
After analyzing multiple options, we strongly recommend **Option A**, an architecture where `AUSD` is a native Aave reserve, and its minting is controlled by a system of governance-approved "Facilitators." This model is the most secure and efficient, maximizing reuse of Aave's battle-tested infrastructure.

**Core Design & Justification:**
*   **Maximal Reuse:** This design completely reuses Aave's most critical components: the **liquidation engine, health factor calculations, oracle framework, and risk parameters (LTV, Liquidation Thresholds)**. Re-implementing these systems would introduce unnecessary risk and complexity.
*   **Minimal Core Changes:** The implementation requires only one minor, targeted change to `BorrowLogic.sol` to recognize facilitators. The majority of the new logic is isolated in new, modular contracts.
*   **Unified User Experience:** A user's `AUSD` debt is a native Aave debt position. This provides a single, clear health factor for users to manage, simplifying risk and enhancing composability with the broader DeFi ecosystem.
*   **Robust Security:** Risk is compartmentalized. Facilitators are sandboxed with individual debt ceilings controlled by Aave Governance. The design inherits Aave's security posture and robust `PriceOracleSentinel` for oracle failure protection.

**Key Components:**
1.  **`AUSD` Token:** The ERC20 stablecoin.
2.  **`AUSDController`:** A governance-managed contract that authorizes facilitators and sets their debt ceilings.
3.  **`CDPManager` (Facilitator):** Allows users to mint `AUSD` against their collateral supplied to Aave.
4.  **`PSM` (Facilitator):** A Peg Stability Module that defends the peg via 1:1 swaps with a reference stablecoin (e.g., USDC).

**Conclusion:** The proposed architecture represents the safest, most robust, and most "Aave-native" path to launching a successful stablecoin. It is a capital-efficient design that extends the functionality of the Aave protocol without compromising its core security principles.

---

## 1. Detailed Technical Specification

### 1.1. Architecture Rationale
The "Aave-Native Reserve + Facilitator Minting" model was chosen because it avoids the significant drawbacks of the alternatives. A "Sidecar" model (Option B) would require building a risky, parallel liquidation engine, while a "Hybrid" model (Option C) would necessitate dangerous and invasive changes to Aave's core logic. Option A provides the best balance of functionality, security, and integration.

### 1.2. Core Components
*   **`AUSD.sol`:** A standard ERC20 token. Its supply is entirely controlled by the Aave `Pool`'s tokenization logic (i.e., the minting of debt tokens).
*   **`AUSDController.sol`:** The central nervous system for `AUSD` governance. It holds the registry of active facilitators and their debt ceilings. Aave Governance is the sole owner of this contract.
*   **`CDPManager.sol`:** The primary user-facing facilitator. It wraps the `Pool.borrow` and `Pool.repay` functions, allowing users to manage `AUSD` debt against their Aave collateral portfolio. It uses Aave's `approveDelegation` feature, so it never holds user collateral.
*   **`PSM.sol`:** The Peg Stability Module. It acts as an arbitrage bot, minting and burning `AUSD` via the `Pool` in exchange for a reference stablecoin (`USDC`) to maintain the peg.

### 1.3. Key User Flows (Text-based Sequence)

**Flow 1: Minting AUSD via CDPManager**
1.  **User:** Supplies `WETH` to Aave `Pool`, receives `aWETH`.
2.  **User:** Calls `approveDelegation` on the `AUSD` `stableDebtToken`, delegating minting power to the `CDPManager`.
3.  **User:** Calls `CDPManager.openCDPAndMint(amount)`.
4.  **`CDPManager`:** Verifies user's borrow power.
5.  **`CDPManager`:** Calls `Aave Pool.borrow(AUSD, amount, ..., onBehalfOf: User)`.
6.  **`Pool` (`BorrowLogic`):**
    *   Checks if `msg.sender` (`CDPManager`) is a valid facilitator via the `AUSDController`.
    *   Checks if the mint violates the facilitator's debt ceiling.
    *   Performs the standard health factor check on the `User`.
    *   Mints `AUSD` debt tokens to the `User`.
    *   Transfers `AUSD` to the `User`.
7.  **Result:** The user has `AUSD`, and their Aave Health Factor has decreased, reflecting the new native debt.

**Flow 2: Defending the Peg with the PSM (`AUSD > $1`)**
1.  **Arbitrageur:** Calls `PSM.swapToAUSD(amountUSDC)`.
2.  **`PSM`:** Pulls `USDC` from the Arbitrageur.
3.  **`PSM`:** Calls `Aave Pool.borrow(AUSD, amountAUSD, ..., onBehalfOf: PSM)`.
4.  **`Pool`:** Verifies the `PSM` is a facilitator and is within its debt ceiling. Mints `AUSD` to the `PSM`.
5.  **`PSM`:** Transfers the newly minted `AUSD` to the Arbitrageur.
6.  **Result:** `AUSD` supply increases, driving the market price down towards $1.

---

## 2. Minimal-Change Implementation Plan

### 2.1. New Contracts
*   `AUSD.sol`: The ERC20 token.
*   `AUSDController.sol`: Manages facilitators and permissions.
*   `CDPManager.sol`: Facilitator for user-generated CDPs.
*   `PSM.sol`: Facilitator for peg stability.
*   `ZeroRateStrategy.sol`: A new interest rate contract that returns a borrow rate of 0.

### 2.2. Modified Contracts
*   **`contracts/protocol/libraries/logic/BorrowLogic.sol`:**
    *   **Change:** A small, targeted `if` block at the start of `executeBorrow` to check for `AUSD`. If the asset is `AUSD`, the logic verifies the caller with the `AUSDController` and checks its debt ceiling before proceeding with the standard borrow flow. A similar check is needed in `executeRepay` to decrement the facilitator's debt.
*   **`contracts/protocol/configuration/PoolAddressesProvider.sol`:**
    *   **Change:** Add a new state variable and a getter/setter for the `AUSDController` address.

### 2.3. Governance & Configuration Checklist
A single Aave Improvement Proposal (AIP) will execute the following:
1.  Deploy all new contracts.
2.  Call `PoolAddressesProvider.setAUSDController()` to register the controller.
3.  Call `PoolConfigurator.initReserve()` to list `AUSD` as a reserve, using `ZeroRateStrategy`.
4.  Call `PoolConfigurator.setConfiguration()` to set `AUSD` risk parameters (LTV=0%, LiquidationThreshold=100%).
5.  Call `AUSDController.addFacilitator()` for both the `CDPManager` and `PSM` with their initial debt ceilings.

---

## 3. Risk, Security, and Testing Plan

### 3.1. Risk Register & Threat Model
*   **Re-entrancy:** Mitigated by using `nonReentrant` modifiers on all new facilitator contracts and following the checks-effects-interactions pattern.
*   **Oracle Failure:** Mitigated by inheriting Aave's `PriceOracleSentinel` mechanism, which halts liquidations and borrows for assets with stale prices.
*   **Economic Exploits:**
    *   *Circular Leverage:* Mitigated by setting `AUSD`'s LTV to 0.
    *   *PSM Drain:* Mitigated by the facilitator debt ceiling and swap fees.
*   **Governance Risk:** Mitigated by the clarity of the `AUSDController` as a single point of control and the standard AIP voting delay, allowing for community review.

### 3.2. Formal Invariants for Fuzzing
*   `AUSD.totalSupply() == AUSDController.totalFacilitatorDebt()`
*   A facilitator's `currentDebt` must never exceed its `debtCeiling`.
*   `AUSD` reserve LTV must always be 0.
*   The PSM's `USDC` balance must be sufficient to cover redemptions for the `AUSD` it has minted.

### 3.3. Test Plan
A multi-layered approach is required:
1.  **Unit Tests:** For every function in the new contracts.
2.  **Fuzz Tests:** Use Foundry to fuzz user interactions, ensuring invariants are never violated.
3.  **Economic Simulations (Mainnet Fork):**
    *   Simulate sharp collateral price drops to test liquidation efficiency.
    *   Simulate a "bank run" on the PSM to test the debt ceiling circuit breaker.
    *   Simulate oracle freeze events to test the sentinel's protection.

---

## 4. Initial Parameter Sheet (Recommendations)

| Parameter | Recommended Value | Rationale |
| --- | --- | --- |
| **AUSD Reserve LTV** | 0% | Critical for preventing circular leverage abuse. |
| **Collateral Liquidation Thresholds** | Use existing Aave values (e.g., 85% for WETH) | Leverages existing, carefully calibrated risk parameters. |
| **Collateral Liquidation Bonuses** | Use existing Aave values (e.g., 5% for WETH) | Proven to be effective at incentivizing liquidators. |
| **Stability Fee** | 1.5% APR (managed by `CDPManager`) | An initial rate to generate protocol revenue. Adjustable by governance. |
| **`CDPManager` Debt Ceiling** | 20,000,000 | A conservative starting cap to limit initial risk. |
| **`PSM` Debt Ceiling** | 10,000,000 | Limits exposure to the reference stablecoin (`USDC`). |
| **`PSM` Fees (In/Out)** | 5 bps (0.05%) | Low enough to incentivize tight arbitrage for the peg. |
| **Oracle Staleness** | Use Aave default (~1-2 hours) | Inherits Aave's standard safety threshold. |

---

## 5. Migration & Rollout Plan

A phased rollout is recommended to ensure maximum safety and stability.

*   **Phase 0: Testnet Deployment & Audit**
    *   Deploy all components to the Sepolia testnet.
    *   Complete at least one full external audit from a reputable firm.
    *   Launch a public bug bounty program focused on the new contracts.
*   **Phase 1: Limited Mainnet Launch**
    *   Launch on mainnet with a low initial `CDPManager` debt ceiling (e.g., 5M `AUSD`).
    *   Enable only the highest-quality assets as collateral (e.g., `WETH`, `WBTC`).
    *   Keep the `PSM` facilitator disabled initially to observe organic peg formation and demand.
*   **Phase 2: PSM Activation & Gradual Scaling**
    *   Activate the `PSM` with a conservative debt ceiling (e.g., 2-5M `AUSD`).
    *   Based on market stability and demand, governance can incrementally increase the debt ceilings for both the `CDPManager` and the `PSM`.
*   **Phase 3: Full Launch & Expansion**
    *   Following successful operation, governance can consider proposals to add more collateral types based on standard Aave risk assessments.
    *   Explore the development of new, specialized facilitators (e.g., for Real-World Assets).

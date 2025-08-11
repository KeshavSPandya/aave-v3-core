# Final Recommendation: The "Native Debt" CDP Model

## Executive Summary

**Objective:** To design a CDP stablecoin (`aUSD`) that maximizes the reuse of Aave's battle-tested framework, avoids the complexity of a parallel system, and provides a clear, visible peg management mechanism.

**Recommended Architecture: The "Native Debt" CDP Model**
This model is the most elegant and secure path forward. It achieves the user's goals by treating `aUSD` as a standard Aave reserve, making it a natural extension of the protocol. It leverages Aave's native borrowing, health factor calculation, and liquidation engine without modification. The stability fee is managed via a simple, custom `IReserveInterestRateStrategy` contract, which plugs directly into Aave's existing architecture. This avoids the need to maintain a separate codebase for debt management, as requested.

**Core Design & Justification:**
*   **Maximum Reuse, Minimum New Code:** This design requires only one new, simple smart contract. All core CDP lifecycle events—minting (borrowing), fee accrual, and liquidation—are handled by the existing, audited Aave V3 contracts.
*   **Transparent Peg Management:** The peg is maintained by the same transparent, market-driven arbitrage forces that govern every other asset in the Aave protocol. There is no hidden, off-chain, or complex facilitator logic. A PSM is not required for core functionality but can be added later as a capital-efficient enhancement if desired.
*   **Unified User Experience:** Users interact with the standard Aave interface. Their `aUSD` debt is part of their global Aave position, represented by a single health factor. This eliminates the confusion of managing positions across two separate systems.
*   **Simplicity & Security:** By avoiding a parallel system, we dramatically reduce the audit surface area and the risk of bugs or economic exploits that could arise from managing a separate liquidation engine and oracle system.

**Conclusion:** The "Native Debt" model is the superior architecture. It directly addresses the feedback provided, delivering a true CDP experience that is deeply integrated, highly secure, and leverages the full power of the Aave protocol.

---

## 1. "Native Debt" CDP Model: Technical Specification

### 1.1. Core Concept: Stability Fee as an Interest Rate
The key insight of this model is that Aave's existing variable interest rate mechanism can be repurposed to function as a stability fee system. By creating a custom interest rate strategy contract that returns a constant value (the "stability fee"), we can use Aave's battle-tested `variableBorrowIndex` to automatically and efficiently accrue fees on all outstanding `aUSD` debt.

### 1.2. `CDPInterestRateStrategy.sol` Detailed Design
*   **Purpose:** The only new smart contract required. It implements Aave's `IReserveInterestRateStrategy` interface.
*   **Ownership:** Owned by Aave Governance.
*   **State:** Contains a single state variable: `uint256 public stabilityFeeRay`.
*   **Governance Control:** A single function, `setStabilityFee()`, allows Aave Governance to act as the monetary policy committee, adjusting the fee based on market conditions.
*   **Core Logic:** The `calculateInterestRates()` function is extremely simple. It always returns a tuple where the `liquidityRate` is 0, the `stableBorrowRate` is 0 (disabling this mode), and the `variableBorrowRate` is equal to the `stabilityFeeRay`.

### 1.3. User Interaction Flow & Aave Core Integration
A user mints `aUSD` by calling the standard `Aave Pool.borrow()` function. The Aave protocol then automatically:
1.  Updates the `variableBorrowIndex` for the `aUSD` reserve using the `stabilityFeeRay` from our custom strategy, accruing fees for all existing borrowers.
2.  Performs the standard health factor check on the user's combined collateral and debt position.
3.  Mints `variableDebtToken`s to the user, creating the native debt.
4.  Transfers the `aUSD` stablecoin to the user.
The user's position is now indistinguishable from any other Aave borrow position and is subject to the same liquidation logic.

---

## 2. Implementation & Configuration Plan

### 2.1. New Contracts Required
1.  **`CDPInterestRateStrategy.sol`**: The simple strategy contract described above.
2.  **`AaveUSD.sol` (`aUSD`)**: A standard ERC20 token to be listed as a new reserve asset.

### 2.2. Step-by-Step Governance Launch Plan
A single AIP is required to:
1.  Deploy a standard ERC20 for `aUSD` and the new `CDPInterestRateStrategy.sol` contract.
2.  Initialize `aUSD` as a new reserve on the Aave `Pool`, assigning our custom strategy contract to it.
3.  Configure the `aUSD` reserve's risk parameters, critically setting **`LTV = 0%`** (to prevent `aUSD` from being used as collateral) and **`ReserveFactor = 100%`** (to direct all stability fees to the Aave Treasury, which acts as a surplus buffer).
4.  Call `setStabilityFee()` on the strategy contract to set the initial fee (e.g., 2.0% APR).

---

## 3. Security & Risk Model

### 3.1. Threat Analysis
*   **Governance Risk:** The primary risk is now concentrated in governance's ability to set the `stabilityFee` appropriately. A fee set too high could stifle adoption; a fee set too low could lead to excessive risk-taking. This risk is mitigated by the standard Aave governance process, which includes community discussion and a voting delay.
*   **Economic Risk:** The main economic risk is managing the growth and stability of `aUSD`. This is managed through the standard Aave risk parameters for the assets accepted as collateral (LTVs, liquidation thresholds, and supply/borrow caps).
*   **Smart Contract Risk:** Dramatically minimized. The only new component is the `CDPInterestRateStrategy` contract, which has a very small and simple codebase, making it easy to audit and formally verify.

### 3.2. Formal Invariants for Testing
1.  **LTV Invariant:** The `LTV` for the `aUSD` reserve must always be 0.
2.  **Fee Invariant:** The `currentVariableBorrowRate` for the `aUSD` reserve must always equal the `stabilityFeeRay` set in the strategy contract.

---

## 4. Peg Management Framework

This model's peg management is transparent and market-driven, addressing the feedback on the opacity of other systems.
*   **Primary Mechanism: Open Market Arbitrage.** The system relies on the same arbitrage mechanism that keeps every other asset on Aave priced correctly relative to its market value.
    *   **If `aUSD` trades > $1.00:** Arbitrageurs will mint `aUSD` by borrowing it from the Aave pool and immediately sell it on the open market for a profit. This selling pressure drives the price back down to $1.00.
    *   **If `aUSD` trades < $1.00:** Arbitrageurs will buy cheap `aUSD` on the open market and use it to repay their debt in the Aave protocol at face value ($1.00), realizing a profit. This buying pressure drives the price back up to $1.00.
*   **Secondary Mechanism (Optional Enhancement): PSM.** A Peg Stability Module can be added later as a separate, capital-efficient module to provide a more rigid price floor and ceiling. However, it is not required for the core functionality and stability of the system, which stands on its own via market arbitrage.

This concludes the final deliverable for the "Native Debt" CDP model. It is a robust, secure, and elegant solution that fully leverages the power of the Aave protocol.

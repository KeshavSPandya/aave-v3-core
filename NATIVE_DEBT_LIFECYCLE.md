# Full Life Cycle of the "Native Debt" Stablecoin (`aUSD`)

This document explains the complete user journey and system mechanics for `aUSD`, from its creation to its destruction, all within the native Aave V3 framework.

---

### **Phase 1: Minting (Creation of `aUSD`)**

This phase is equivalent to a user taking out a loan in the Aave protocol.

1.  **Prerequisite: User Has Aave Collateral.**
    A user must have already supplied assets (e.g., `WETH`, `WBTC`) to the Aave V3 protocol. By doing so, they have an active collateral position and a Health Factor greater than 1.

2.  **Action: User Calls `borrow()`**
    The user interacts with the standard Aave `Pool.sol` contract. They initiate a `borrow` transaction for the `aUSD` asset.
    *   **Function:** `Pool.borrow(aUSD_address, amount_to_mint, interestRateMode=VARIABLE, ...)`
    *   **User Experience:** This is identical to borrowing any other asset on Aave. The user is simply minting the stablecoin by borrowing it against their existing collateral portfolio.

3.  **Aave Protocol Mechanics (Internal):**
    *   **Fee Accrual:** The protocol first updates the `aUSD` reserve's state. It calls our custom `CDPInterestRateStrategy` contract, gets the `stabilityFeeRay`, and updates the `variableBorrowIndex`. This ensures all existing `aUSD` debt accrues the stability fee up to the current moment.
    *   **Health Factor Check:** Aave's `ValidationLogic` performs the critical health factor check. It calculates the user's total collateral value against their total debt (including the new `aUSD` they are about to mint). If the user's Health Factor remains above 1, the transaction is allowed to proceed.
    *   **Debt Token Minting:** The protocol mints `variableDebtAUSD` tokens to the user's account. This is the on-chain record of their debt within the Aave ecosystem.
    *   **`aUSD` Transfer:** The requested amount of `aUSD` is transferred to the user's wallet.

**Result:** The user now holds newly created `aUSD`. The total supply of `aUSD` has increased, and this new debt is natively accounted for in the user's Aave position.

---

### **Phase 2: Holding & Fee Accrual**

While a user holds an outstanding `aUSD` debt, a stability fee is continuously charged.

1.  **Mechanism: The Variable Borrow Index**
    *   The stability fee is not actively "charged" in discreet transactions. Instead, it accrues passively and continuously.
    *   The `variableBorrowIndex` of the `aUSD` reserve constantly increases over time, driven by the `stabilityFeeRay` value provided by our custom strategy contract.
    *   A user's true debt at any moment is their initial borrowed amount scaled by the current value of the `variableBorrowIndex`.

2.  **Accrual Trigger:**
    *   The index (and thus the accrued fee) is updated on-chain whenever *any* user interacts with the `aUSD` reserve (e.g., another user mints, repays, or gets liquidated). This socializes the gas cost of state updates across all protocol users.

**Result:** The user's `aUSD` debt grows slowly over time, reflecting the stability fee. This accrued fee is the primary revenue source for the protocol and is directed to the Aave Treasury via the `reserveFactor`.

---

### **Phase 3: Repayment (Burning of `aUSD`)**

This phase is equivalent to a user repaying a loan in the Aave protocol.

1.  **Action: User Calls `repay()`**
    The user interacts with the standard Aave `Pool.sol` contract. They initiate a `repay` transaction for the `aUSD` asset.
    *   **Function:** `Pool.repay(aUSD_address, amount_to_repay, interestRateMode=VARIABLE, ...)`
    *   **User Experience:** This is identical to repaying any other asset on Aave.

2.  **Aave Protocol Mechanics (Internal):**
    *   The user must first have `aUSD` in their wallet (or approve the pool to pull it).
    *   The protocol calculates the user's up-to-the-second debt, including all accrued stability fees.
    *   The `aUSD` provided by the user is taken, and their `variableDebtAUSD` tokens are burned, reducing or eliminating their debt position.
    *   The user's Health Factor increases as their debt is reduced.

**Result:** The user's debt is paid off. The `aUSD` they repaid is effectively removed from circulation, balancing the system's accounting.

---

### **Phase 4: Liquidation (Forced Repayment)**

This occurs if a user's Health Factor drops below 1 due to their collateral value falling or their debt value rising.

1.  **Trigger: Health Factor < 1**
    *   Any third-party liquidator (a bot or another user) can see that the user's position is undercollateralized.

2.  **Action: Liquidator Calls `liquidationCall()`**
    The liquidator interacts with the standard Aave `Pool.sol` contract.
    *   **Function:** `liquidationCall(collateral_to_seize, aUSD_address, user_to_liquidate, debt_to_repay, ...)`

3.  **Aave Protocol Mechanics (Internal):**
    *   The liquidator provides `aUSD` to the pool to repay a portion of the underwater user's debt.
    *   The underwater user's `variableDebtAUSD` tokens are burned, paying down their debt.
    *   In return, the liquidator is allowed to claim a corresponding amount of the user's collateral (e.g., their `WETH`) at a discount (the `liquidationBonus`).
    *   The user's position is made healthier, and the liquidator profits from the bonus.

**Result:** The protocol's solvency is maintained. Bad debt is cleared from the system by market participants who are incentivized by the liquidation bonus. This entire process uses the existing, battle-tested Aave liquidation engine.

---

### **Phase 5: Peg Management (Market-Driven Stability)**

The `aUSD` peg to $1.00 is maintained by transparent, on-chain market forces, not by a hidden or complex facilitator.

*   **When `aUSD` Price > $1.00:**
    *   **Opportunity:** Arbitrageurs see `aUSD` is expensive.
    *   **Action:** They mint `aUSD` from the Aave protocol for exactly $1.00 worth of borrowing power and immediately sell it on the open market (e.g., on Uniswap) for >$1.00, capturing a profit.
    *   **Effect:** This selling pressure increases the supply of `aUSD` on the market, driving its price back down to $1.00.

*   **When `aUSD` Price < $1.00:**
    *   **Opportunity:** Arbitrageurs see `aUSD` is cheap.
    *   **Action:** They buy discounted `aUSD` on the open market and use it to repay their own (or someone else's) `aUSD` debt in the Aave protocol at its full face value of $1.00, capturing a profit.
    *   **Effect:** This buying pressure removes `aUSD` from the market, driving its price back up to $1.00.

This arbitrage loop is the fundamental mechanism that keeps all assets in Aave aligned with their market price and ensures `aUSD` remains stable.

# Integrating Real-World Assets (RWA) into the "Native Debt" Model

This document outlines the strategy and architecture for incorporating tokenized Real-World Assets, such as tokenized treasuries or insured receivables, as collateral for minting `aUSD` within the recommended "Native Debt" Aave V3 model.

The "Native Debt" model is exceptionally well-suited for this because it relies entirely on Aave's core risk framework. Therefore, integrating RWA is not a question of changing the `aUSD` system, but rather a question of **how to safely onboard an RWA as a standard collateral asset into the main Aave V3 protocol.**

Here is the full life cycle and process:

---

### **Step 1: Tokenization & Legal Framework (Off-Chain)**

This is the most critical and complex step, occurring entirely outside the Aave protocol.

1.  **Asset Origination:** A legally compliant entity must source and custody the off-chain asset (e.g., U.S. Treasury bonds, corporate debt, real estate loans).
2.  **Legal Structuring:** The asset must be placed in a bankruptcy-remote Special Purpose Vehicle (SPV). This is a legal requirement to ensure that if the originating company fails, the on-chain token holders have a clear legal claim to the underlying assets.
3.  **Tokenization:** The SPV issues a token (e.g., an ERC-20 token like `TBT` for "Tokenized Treasury Bill") that represents a direct claim on the underlying asset. The total supply of this token must be backed 1:1 by the off-chain assets.
4.  **Audits & Legal Opinions:** The entire off-chain structure must be audited, and legal opinions must be published confirming the validity and enforceability of the token holders' claims.

---

### **Step 2: Onboarding the RWA Token to Aave V3 (The Core Task)**

Once the RWA is represented by a reliable ERC-20 token, it can be proposed as a new collateral type for the main Aave V3 market through Aave Governance.

1.  **Aave Governance Proposal (AIP):** A detailed proposal must be submitted to the Aave community. This proposal must include:
    *   Full details of the RWA's off-chain legal structure.
    *   Audits and legal opinions.
    *   A reliable, on-chain price feed for the RWA token.

2.  **The Oracle Challenge:** This is the biggest technical hurdle for RWAs. Unlike crypto assets with deep, liquid on-chain markets, the price of an RWA is often determined off-chain.
    *   **Solution:** A trusted oracle provider like Chainlink must be used. Chainlink can create a custom price feed that ingests data from trusted off-chain sources (e.g., the asset manager, a fund administrator) and posts it securely on-chain. This feed must have strong guarantees against manipulation and downtime.

3.  **Risk Parameterization:** Aave's risk managers and the community must agree on a conservative set of risk parameters for the new RWA asset.
    *   **LTV (Loan-to-Value):** Will likely be very conservative initially (e.g., **50-70%**) due to the liquidity and legal risks associated with RWAs.
    *   **Liquidation Threshold:** Set slightly higher than the LTV (e.g., **75%**).
    *   **Liquidation Bonus:** This is complex. Since RWAs may not be liquid on DEXs, the liquidation bonus must be high enough to incentivize liquidators who may need to redeem the RWA token off-chain to realize its value. A bonus of **10-15%** might be required.
    *   **Supply Cap:** A hard cap on the total amount of the RWA token that can be supplied to Aave. This is crucial for limiting the protocol's overall exposure to a new and less-tested asset class.
    *   **Borrow Cap:** A cap on how much can be borrowed against the RWA collateral.

4.  **Governance Vote:** If the AIP passes, the Aave protocol will list the RWA token as a new collateral asset.

---

### **Step 3: Using the RWA to Mint `aUSD` (The User Journey)**

Once the RWA token is an accepted collateral in Aave, using it to mint `aUSD` is **identical** to using any other collateral like `WETH`.

1.  **User Supplies RWA Token:** The user calls `Pool.supply(RWA_token_address, amount)`. They receive the corresponding `aToken` (e.g., `aTBT`).
2.  **User Mints `aUSD`:** The user calls `Pool.borrow(aUSD_address, amount_to_mint, ...)`.
3.  **Aave Protocol Manages Risk:** The Aave protocol automatically calculates the user's health factor based on the value of their `aTBT` collateral (as reported by the Chainlink oracle) and their outstanding debt.

---

### **Step 4: Liquidation**

The liquidation process also uses the standard Aave engine, but with a different economic reality for the liquidator.

1.  **Health Factor < 1:** If the value of the user's RWA collateral drops or their debt increases, their health factor falls below 1.
2.  **Liquidator Action:** A liquidator calls `liquidationCall()`. They repay the user's `aUSD` debt.
3.  **Receiving RWA `aTokens`:** In return, the liquidator receives the user's RWA `aTokens` (`aTBT`) at a discount.
4.  **Realizing Profit (The RWA Difference):** Unlike with `WETH` which can be instantly sold on a DEX, the liquidator now holds `aTBT`. To realize their profit, they must engage with the RWA issuer's off-chain process to redeem the `aTBT` tokens for the underlying off-chain asset (e.g., fiat currency). This is why the `liquidationBonus` must be substantial enough to compensate for this added complexity and potential delay.

### **Conclusion**

The "Native Debt" model is perfectly suited for RWA integration because it cleanly separates the concerns. The `aUSD` system does not need to change at all. The entire challenge and complexity of RWA integration lies in the **governance, risk assessment, and oracle problem of safely onboarding the RWA token into the main Aave V3 protocol.** Once an RWA is accepted as collateral by Aave, it automatically becomes eligible for use in minting `aUSD`.

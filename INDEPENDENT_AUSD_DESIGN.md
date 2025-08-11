# Independent CDP Stablecoin Layer: Architecture & Design

## Executive Summary

**Objective:** This document presents a first-principles analysis and design for an **independent** Collateralized Debt Position (CDP) stablecoin layer that leverages Aave v3's `aTokens` as collateral. The goal was to design a modular, secure, and highly composable system without copying existing models like GHO.

**Architectural Analysis:** Three independent architectures were analyzed:
1.  **Decoupled Vault:** High isolation, but high gas costs and operational complexity.
2.  **Lien & External Accounting:** Gas efficient, but requires dangerous, invasive changes to Aave's core `aToken` contracts.
3.  **Tokenized Vault (ERC-721):** Represents each CDP as a tradable NFT, offering unparalleled composability with zero changes to Aave's core.

**Recommendation: The "Tokenized Vault" Architecture**
The recommended path forward is the **Tokenized Vault** model. While it concentrates collateral risk into a single custodian contract—a significant but manageable challenge—its advantages are overwhelming. It is gas-efficient, requires no modification to Aave, and, most importantly, turns CDP positions themselves into liquid, composable financial primitives (NFTs). This aligns with modern DeFi trends and offers the greatest potential for innovation and integration.

**Core Components of the Recommended Design:**
*   **`VaultManager`:** A central custodian contract that holds all `aToken` collateral and manages all vault logic.
*   **`CDPVaultNFT`:** An ERC-721 token where each NFT represents ownership of a specific CDP vault.
*   **`IndependentUSD`:** A new, standalone stablecoin minted and burned exclusively by the `VaultManager`.
*   **`LiquidationEngine` & `AaveOracleAdapter`:** Dedicated modules for handling liquidations and price feeds, keeping the system fully independent.

**Conclusion:** This design fulfills the prompt's core requirements: it is independent, modular, risk-controlled, and does not rely on the GHO facilitator pattern. It establishes a powerful, self-contained financial engine on top of Aave's liquidity layer.

---

## 1. Independent Architecture Options Analysis

### 1.1. Option 1: The "Decoupled Vault" Architecture
*   **Concept:** Each CDP is an individual proxy contract holding its own collateral.
*   **Token Flow:** User deploys a personal vault contract, then transfers `aTokens` to it to mint the stablecoin.
*   **Advantages:** Maximum security isolation between user vaults. Zero changes to Aave core.
*   **Disadvantages:** Prohibitively high gas cost for users due to per-vault deployment. State is fragmented, making global management difficult. Requires a full parallel liquidation/oracle system.

### 1.2. Option 2: The "Lien & External Accounting" Architecture
*   **Concept:** A central contract tracks all vaults. `aTokens` remain in the user's wallet, but with a "lien" preventing their transfer.
*   **Token Flow:** User calls a central `VaultManager` to mint. The manager records a lien on the user's `aTokens` without taking custody.
*   **Advantages:** Extremely gas-efficient. Excellent user experience as tokens remain in-wallet.
*   **Disadvantages:** **Requires invasive modifications to Aave's core `AToken.sol` contract** to enforce the lien. This is a critical security flaw, as it breaks the integrity of the Aave protocol and creates a tight, risky coupling.

### 1.3. Option 3: The "Tokenized Vault" (ERC-721 Inspired) Architecture
*   **Concept:** A central `VaultManager` holds all collateral, but each individual position is represented by a unique, tradable NFT.
*   **Token Flow:** User approves the `VaultManager` to pull `aTokens` from their wallet. In return, the user receives a `CDPVaultNFT` representing their position and the newly minted stablecoin.
*   **Advantages:** Zero changes to Aave core. Gas-efficient for users. Makes CDPs themselves liquid and composable financial assets.
*   **Disadvantages:** Concentrates all protocol collateral into a single contract (the `VaultManager`), making it a high-value target for hackers. The user experience is more complex than simply holding `aTokens`.

---

## 2. Recommended Architecture: The "Tokenized Vault"

### 2.1. Rationale for Selection
This model is chosen for its superior **composability and future-proof design**. While the centralized collateral risk is significant, it is a known and manageable challenge addressed by top-tier security practices. The ability for users to trade, fractionalize, or use their CDP positions as collateral in other protocols is a game-changing feature that sets the system apart. It achieves the goal of being a truly independent yet integrated layer.

## 3. Minimal-Change Integration Plan

This plan requires **zero modifications** to the Aave v3 protocol. It consists entirely of new, standalone contracts.

### 3.1. New Contract Definitions
1.  **`IndependentUSD.sol`**: The ERC20 stablecoin, with mint/burn functions permissioned to the `VaultManager`.
2.  **`CDPVaultNFT.sol`**: The ERC-721 position token, with mint/burn functions permissioned to the `VaultManager`.
3.  **`VaultManager.sol`**: The core logic and custodian contract. Manages all vault state, collateral, and user interactions.
4.  **`LiquidationEngine.sol`**: A separate module for managing the auction of collateral from liquidated vaults.
5.  **`AaveOracleAdapter.sol`**: A price feed adapter that correctly values `aTokens` by combining Aave's underlying price with the live `liquidityIndex`.

## 4. Security & Risk Model

### 4.1. Threat Model
*   **`VaultManager` Centralization:** The primary risk. Mitigated by multiple audits, formal verification, time-locked governance, and aggressive bug bounties.
*   **Re-entrancy:** Mitigated with strict checks-effects-interactions pattern and `nonReentrant` modifiers.
*   **Oracle Manipulation:** Mitigated by using Aave's robust oracle, setting conservative debt ceilings on less liquid assets, and off-chain monitoring.
*   **`aToken` De-Peg:** A systemic risk. Mitigated by encouraging collateral diversity and having an emergency pause capability.

### 4.2. Formal Invariants for Testing
1.  **Total Supply Invariant:** `Stablecoin.totalSupply()` must always equal `sum(all_vaults.debtAmount)`.
2.  **Collateralization Invariant:** The total value of collateral in the `VaultManager` must always exceed the total stablecoin supply.
3.  **Ownership Invariant:** Vault modifications can only be called by the owner of the corresponding `CDPVaultNFT`.

## 5. Parameter Framework

### 5.1. Per-Collateral Asset Parameters
*   **Liquidation Threshold:** Recommended: 85% for `aWETH`, 92% for `aUSDC`.
*   **Liquidation Bonus:** Recommended: 5.0% for `aWETH`, 2.5% for `aUSDC`.
*   **Stability Fee:** Recommended: 2.0% APR to start.
*   **Collateral Debt Ceiling:** Recommended: Start at 50M for `aWETH`, with lower caps for other assets.

## 6. Deployment Roadmap

### 6.1. Phase 0: Pre-Launch
*   Complete development, multiple audits, formal verification, and launch a bug bounty program.
*   Deploy to a public testnet for community testing and partner integration.

### 6.2. Phase 1: Guarded Launch
*   Deploy to mainnet with **only `aWETH` as collateral** and a low debt ceiling (e.g., 5M).
*   Utilize a guardian multi-sig with emergency pause capabilities.

### 6.3. Phase 2: Growth & Diversification
*   Gradually add more high-quality collateral types and increase debt ceilings, as approved by governance.
*   Transition from the guardian multi-sig to a fully decentralized DAO.

This concludes the final deliverable for the independent CDP layer design.

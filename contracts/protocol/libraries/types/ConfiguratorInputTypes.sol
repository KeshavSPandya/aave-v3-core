// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library ConfiguratorInputTypes {
  struct InitReserveInput {
    address kTokenImpl; // Renamed aTokenImpl to kTokenImpl
    address stableDebtTokenImpl;
    address variableDebtTokenImpl;
    uint8 underlyingAssetDecimals;
    address interestRateStrategyAddress;
    address underlyingAsset;
    address treasury;
    address incentivesController;
    string kTokenName; // Renamed aTokenName to kTokenName
    string kTokenSymbol; // Renamed aTokenSymbol to kTokenSymbol
    string variableDebtTokenName;
    string variableDebtTokenSymbol;
    string stableDebtTokenName;
    string stableDebtTokenSymbol;
    bytes params;
  }

  struct UpdateKTokenInput { // Renamed UpdateATokenInput to UpdateKTokenInput
    address asset;
    address treasury;
    address incentivesController;
    string name; // Assuming 'name' and 'symbol' are generic enough for KToken
    string symbol; // Assuming 'name' and 'symbol' are generic enough for KToken
    address implementation; // Assuming 'implementation' refers to the KToken implementation
    bytes params;
  }

  struct UpdateDebtTokenInput {
    address asset;
    address incentivesController;
    string name;
    string symbol;
    address implementation;
    bytes params;
  }
}

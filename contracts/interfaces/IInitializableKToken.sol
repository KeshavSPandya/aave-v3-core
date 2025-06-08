// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import {IAaveIncentivesController} from './IAaveIncentivesController.sol';
import {IPool} from './IPool.sol';

/**
 * @title IInitializableKToken
 * @author Aave
 * @notice Interface for the initialize function on KToken
 */
interface IInitializableKToken {
  /**
   * @dev Emitted when an kToken is initialized
   * @param underlyingAsset The address of the underlying asset
   * @param pool The address of the associated pool
   * @param treasury The address of the treasury
   * @param incentivesController The address of the incentives controller for this kToken
   * @param kTokenDecimals The decimals of the underlying
   * @param kTokenName The name of the kToken
   * @param kTokenSymbol The symbol of the kToken
   * @param params A set of encoded parameters for additional initialization
   */
  event Initialized(
    address indexed underlyingAsset,
    address indexed pool,
    address treasury,
    address incentivesController,
    uint8 kTokenDecimals,
    string kTokenName,
    string kTokenSymbol,
    bytes params
  );

  /**
   * @notice Initializes the kToken
   * @param pool The pool contract that is initializing this contract
   * @param treasury The address of the Aave treasury, receiving the fees on this kToken
   * @param underlyingAsset The address of the underlying asset of this kToken (E.g. WETH for aWETH)
   * @param incentivesController The smart contract managing potential incentives distribution
   * @param kTokenDecimals The decimals of the kToken, same as the underlying asset's
   * @param kTokenName The name of the kToken
   * @param kTokenSymbol The symbol of the kToken
   * @param params A set of encoded parameters for additional initialization
   */
  function initialize(
    IPool pool,
    address treasury,
    address underlyingAsset,
    IAaveIncentivesController incentivesController,
    uint8 kTokenDecimals,
    string calldata kTokenName,
    string calldata kTokenSymbol,
    bytes calldata params
  ) external;
}

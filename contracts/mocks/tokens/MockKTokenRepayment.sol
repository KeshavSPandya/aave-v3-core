// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {KToken} from '../../protocol/tokenization/KToken.sol'; // Changed AToken to KToken
import {IPool} from '../../interfaces/IPool.sol';

contract MockKTokenRepayment is KToken { // Changed MockATokenRepayment to MockKTokenRepayment and AToken to KToken
  event MockRepayment(address user, address onBehalfOf, uint256 amount);

  constructor(IPool pool) KToken(pool) {} // Changed AToken to KToken

  function getRevision() internal pure override returns (uint256) {
    return 0x2;
  }

  function handleRepayment(
    address user,
    address onBehalfOf,
    uint256 amount
  ) external override onlyPool {
    emit MockRepayment(user, onBehalfOf, amount);
  }
}

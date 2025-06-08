// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {KToken} from '../../protocol/tokenization/KToken.sol'; // Changed AToken to KToken
import {IPool} from '../../interfaces/IPool.sol';

contract MockKToken is KToken { // Changed AToken to KToken
  constructor(IPool pool) KToken(pool) {} // Changed AToken to KToken

  function getRevision() internal pure override returns (uint256) {
    return 0x2;
  }
}

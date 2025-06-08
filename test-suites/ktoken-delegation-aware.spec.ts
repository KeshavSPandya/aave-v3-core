import { DelegationAwareKToken, MintableDelegationERC20 } from '../types'; // Changed DelegationAwareAToken to DelegationAwareKToken
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../helpers/constants';
import { ProtocolErrors } from '../helpers/types';
import { makeSuite, TestEnv } from './helpers/make-suite';
import {
  deployMintableDelegationERC20,
  deployDelegationAwareKToken, // Changed deployDelegationAwareAToken to deployDelegationAwareKToken
} from '@aave/deploy-v3/dist/helpers/contract-deployments'; // Assuming this helper will also be updated

makeSuite('KToken: DelegationAwareKToken', (testEnv: TestEnv) => { // Changed AToken to KToken
  let delegationKToken = <DelegationAwareKToken>{}; // Changed delegationAToken to delegationKToken, DelegationAwareAToken to DelegationAwareKToken
  let delegationERC20 = <MintableDelegationERC20>{};

  it('Deploys a new MintableDelegationERC20 and a DelegationAwareKToken', async () => { // Changed DelegationAwareAToken to DelegationAwareKToken
    const { pool } = testEnv;

    delegationERC20 = await deployMintableDelegationERC20(['DEL', 'DEL', '18']);

    // Assuming the deployment helper and its parameters will be updated for KToken
    delegationKToken = await deployDelegationAwareKToken([ // Changed delegationAToken to delegationKToken, deployDelegationAwareAToken to deployDelegationAwareKToken
      pool.address,
      delegationERC20.address,
      ZERO_ADDRESS, // treasury
      ZERO_ADDRESS, // incentivesController
      'aDEL', // kTokenName (assuming name might change)
      'aDEL', // kTokenSymbol (assuming symbol might change)
      // params - if needed for KToken
    ]);
  });

  it('Tries to delegate with the caller not being the Aave admin (revert expected)', async () => {
    const { users } = testEnv;

    await expect(
      delegationKToken.connect(users[1].signer).delegateUnderlyingTo(users[2].address) // Changed delegationAToken to delegationKToken
    ).to.be.revertedWith(ProtocolErrors.CALLER_NOT_POOL_ADMIN);
  });

  it('Delegates to user 2', async () => {
    const { users } = testEnv;

    await expect(delegationKToken.delegateUnderlyingTo(users[2].address)) // Changed delegationAToken to delegationKToken
      .to.emit(delegationKToken, 'DelegateUnderlyingTo') // Changed delegationAToken to delegationKToken
      .withArgs(users[2].address);

    const delegateeAddress = await delegationERC20.delegatee();

    expect(delegateeAddress).to.be.equal(users[2].address);
  });
});

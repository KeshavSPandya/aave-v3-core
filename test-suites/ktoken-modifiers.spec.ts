import { expect } from 'chai';
import { ProtocolErrors } from '../helpers/types';
import { makeSuite, TestEnv } from './helpers/make-suite';

makeSuite('KToken: Modifiers', (testEnv: TestEnv) => { // Changed AToken to KToken
  const { CALLER_MUST_BE_POOL } = ProtocolErrors;

  it('Tries to invoke mint not being the Pool (revert expected)', async () => {
    const { deployer, kDai } = testEnv; // Changed aDai to kDai
    await expect(kDai.mint(deployer.address, deployer.address, '1', '1')).to.be.revertedWith( // Changed aDai to kDai
      CALLER_MUST_BE_POOL
    );
  });

  it('Tries to invoke burn not being the Pool (revert expected)', async () => {
    const { deployer, kDai } = testEnv; // Changed aDai to kDai
    await expect(kDai.burn(deployer.address, deployer.address, '1', '1')).to.be.revertedWith( // Changed aDai to kDai
      CALLER_MUST_BE_POOL
    );
  });

  it('Tries to invoke transferOnLiquidation not being the Pool (revert expected)', async () => {
    const { deployer, users, kDai } = testEnv; // Changed aDai to kDai
    await expect(
      kDai.transferOnLiquidation(deployer.address, users[0].address, '1') // Changed aDai to kDai
    ).to.be.revertedWith(CALLER_MUST_BE_POOL);
  });

  it('Tries to invoke transferUnderlyingTo not being the Pool (revert expected)', async () => {
    const { deployer, kDai } = testEnv; // Changed aDai to kDai
    await expect(kDai.transferUnderlyingTo(deployer.address, '1')).to.be.revertedWith( // Changed aDai to kDai
      CALLER_MUST_BE_POOL
    );
  });
});

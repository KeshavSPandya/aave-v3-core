import { expect } from 'chai';
import { utils } from 'ethers';
import { impersonateAccountsHardhat } from '../helpers/misc-utils';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../helpers/constants';
import { convertToCurrencyDecimals } from '../helpers/contracts-helpers';
import { ProtocolErrors } from '../helpers/types';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { topUpNonPayableWithEther } from './helpers/utils/funds';
import { evmRevert, evmSnapshot, waitForTx } from '@aave/deploy-v3';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

declare var hre: HardhatRuntimeEnvironment;

makeSuite('KToken: Edge cases', (testEnv: TestEnv) => {
  const {
    INVALID_MINT_AMOUNT,
    INVALID_BURN_AMOUNT,
    SAFECAST_UINT128_OVERFLOW,
    CALLER_NOT_POOL_ADMIN,
  } = ProtocolErrors;

  it('Check getters', async () => {
    const { pool, users, dai, kDai } = testEnv; // Changed aDai to kDai

    expect(await kDai.decimals()).to.be.eq(await dai.decimals()); // Changed aDai to kDai
    expect(await kDai.UNDERLYING_ASSET_ADDRESS()).to.be.eq(dai.address); // Changed aDai to kDai
    expect(await kDai.POOL()).to.be.eq(pool.address); // Changed aDai to kDai
    expect(await kDai.getIncentivesController()).to.not.be.eq(ZERO_ADDRESS); // Changed aDai to kDai

    const scaledUserBalanceAndSupplyBefore = await kDai.getScaledUserBalanceAndSupply( // Changed aDai to kDai
      users[0].address
    );
    expect(scaledUserBalanceAndSupplyBefore[0]).to.be.eq(0);
    expect(scaledUserBalanceAndSupplyBefore[1]).to.be.eq(0);

    await waitForTx(
      await dai
        .connect(users[0].signer)
        ['mint(address,uint256)'](
          users[0].address,
          await convertToCurrencyDecimals(dai.address, '1000')
        )
    );
    await waitForTx(await dai.connect(users[0].signer).approve(pool.address, MAX_UINT_AMOUNT));
    await waitForTx(
      await pool
        .connect(users[0].signer)
        .deposit(
          dai.address,
          await convertToCurrencyDecimals(dai.address, '1000'),
          users[0].address,
          0
        )
    );
    const scaledUserBalanceAndSupplyAfter = await aDai.getScaledUserBalanceAndSupply(
      users[0].address
    );
    expect(scaledUserBalanceAndSupplyAfter[0]).to.be.eq(
      await convertToCurrencyDecimals(kDai.address, '1000') // Changed aDai to kDai
    );
    expect(scaledUserBalanceAndSupplyAfter[1]).to.be.eq(
      await convertToCurrencyDecimals(kDai.address, '1000') // Changed aDai to kDai
    );
  });

  it('approve()', async () => {
    const { users, kDai } = testEnv; // Changed aDai to kDai
    await kDai.connect(users[0].signer).approve(users[1].address, MAX_UINT_AMOUNT); // Changed aDai to kDai
    expect(await kDai.allowance(users[0].address, users[1].address)).to.be.eq(MAX_UINT_AMOUNT); // Changed aDai to kDai
  });

  it('approve() with a ZERO_ADDRESS spender', async () => {
    const { users, kDai } = testEnv; // Changed aDai to kDai
    await expect(kDai.connect(users[0].signer).approve(ZERO_ADDRESS, MAX_UINT_AMOUNT)) // Changed aDai to kDai
      .to.emit(kDai, 'Approval') // Changed aDai to kDai
      .withArgs(users[0].address, ZERO_ADDRESS, MAX_UINT_AMOUNT);
  });

  it('transferFrom()', async () => {
    const { users, kDai } = testEnv; // Changed aDai to kDai
    await kDai.connect(users[1].signer).transferFrom(users[0].address, users[1].address, 0); // Changed aDai to kDai
  });

  it('increaseAllowance()', async () => {
    const { users, kDai } = testEnv; // Changed aDai to kDai
    expect(await kDai.allowance(users[1].address, users[0].address)).to.be.eq(0); // Changed aDai to kDai
    await kDai // Changed aDai to kDai
      .connect(users[1].signer)
      .increaseAllowance(users[0].address, await convertToCurrencyDecimals(kDai.address, '1')); // Changed aDai to kDai
    expect(await kDai.allowance(users[1].address, users[0].address)).to.be.eq( // Changed aDai to kDai
      await convertToCurrencyDecimals(kDai.address, '1') // Changed aDai to kDai
    );
  });

  it('decreaseAllowance()', async () => {
    const { users, kDai } = testEnv; // Changed aDai to kDai
    expect(await kDai.allowance(users[1].address, users[0].address)).to.be.eq( // Changed aDai to kDai
      await convertToCurrencyDecimals(kDai.address, '1') // Changed aDai to kDai
    );
    await kDai // Changed aDai to kDai
      .connect(users[1].signer)
      .decreaseAllowance(users[0].address, await convertToCurrencyDecimals(kDai.address, '1')); // Changed aDai to kDai
    expect(await kDai.allowance(users[1].address, users[0].address)).to.be.eq(0); // Changed aDai to kDai
  });

  it('transfer() with a ZERO_ADDRESS recipient', async () => {
    const { users, kDai } = testEnv; // Changed aDai to kDai
    await expect(kDai.connect(users[1].signer).transfer(ZERO_ADDRESS, 0)) // Changed aDai to kDai
      .to.emit(kDai, 'Transfer') // Changed aDai to kDai
      .withArgs(users[1].address, ZERO_ADDRESS, 0);
  });

  it('transfer() with a ZERO_ADDRESS origin', async () => {
    const { users, kDai } = testEnv; // Changed aDai to kDai
    await expect(kDai.connect(users[1].signer).transferFrom(ZERO_ADDRESS, users[1].address, 0)) // Changed aDai to kDai
      .to.emit(kDai, 'Transfer') // Changed aDai to kDai
      .withArgs(ZERO_ADDRESS, users[1].address, 0);
  });

  it('mint() when amountScaled == 0 (revert expected)', async () => {
    const { deployer, pool, kDai, users } = testEnv; // Changed aDai to kDai

    // Impersonate Pool
    await topUpNonPayableWithEther(deployer.signer, [pool.address], utils.parseEther('1'));
    await impersonateAccountsHardhat([pool.address]);
    const poolSigner = await hre.ethers.getSigner(pool.address);

    await expect(
      kDai // Changed aDai to kDai
        .connect(poolSigner)
        .mint(users[0].address, users[0].address, 0, utils.parseUnits('1', 27))
    ).to.be.revertedWith(INVALID_MINT_AMOUNT);
  });

  it('mint() to a ZERO_ADDRESS account', async () => {
    const { deployer, pool, kDai } = testEnv; // Changed aDai to kDai

    // Impersonate Pool
    await topUpNonPayableWithEther(deployer.signer, [pool.address], utils.parseEther('1'));
    await impersonateAccountsHardhat([pool.address]);
    const poolSigner = await hre.ethers.getSigner(pool.address);

    const mintingAmount = await convertToCurrencyDecimals(kDai.address, '100'); // Changed aDai to kDai
    await expect(
      kDai // Changed aDai to kDai
        .connect(poolSigner)
        .mint(ZERO_ADDRESS, ZERO_ADDRESS, mintingAmount, utils.parseUnits('1', 27))
    )
      .to.emit(kDai, 'Transfer') // Changed aDai to kDai
      .withArgs(ZERO_ADDRESS, ZERO_ADDRESS, mintingAmount);
  });

  it('burn() when amountScaled == 0 (revert expected)', async () => {
    const { deployer, pool, kDai, users } = testEnv; // Changed aDai to kDai

    // Impersonate Pool
    await topUpNonPayableWithEther(deployer.signer, [pool.address], utils.parseEther('1'));
    await impersonateAccountsHardhat([pool.address]);
    const poolSigner = await hre.ethers.getSigner(pool.address);

    await expect(
      kDai // Changed aDai to kDai
        .connect(poolSigner)
        .burn(users[0].address, users[0].address, 0, utils.parseUnits('1', 27))
    ).to.be.revertedWith(INVALID_BURN_AMOUNT);
  });

  it('burn() of a ZERO_ADDRESS account (revert expected)', async () => {
    const { deployer, pool, kDai, users } = testEnv; // Changed aDai to kDai

    // Impersonate Pool
    await topUpNonPayableWithEther(deployer.signer, [pool.address], utils.parseEther('1'));
    await impersonateAccountsHardhat([pool.address]);
    const poolSigner = await hre.ethers.getSigner(pool.address);

    const burnAmount = await convertToCurrencyDecimals(kDai.address, '100'); // Changed aDai to kDai
    await expect(
      kDai // Changed aDai to kDai
        .connect(poolSigner)
        .burn(ZERO_ADDRESS, users[0].address, burnAmount, utils.parseUnits('1', 27))
    )
      .to.emit(kDai, 'Transfer') // Changed aDai to kDai
      .withArgs(ZERO_ADDRESS, ZERO_ADDRESS, burnAmount);
  });

  it('mintToTreasury() with amount == 0', async () => {
    const { deployer, pool, kDai } = testEnv; // Changed aDai to kDai

    // Impersonate Pool
    await topUpNonPayableWithEther(deployer.signer, [pool.address], utils.parseEther('1'));
    await impersonateAccountsHardhat([pool.address]);
    const poolSigner = await hre.ethers.getSigner(pool.address);

    expect(await kDai.connect(poolSigner).mintToTreasury(0, utils.parseUnits('1', 27))); // Changed aDai to kDai
  });

  it('setIncentivesController() ', async () => {
    const snapshot = await evmSnapshot();
    const { deployer, poolAdmin, kWETH, aclManager } = testEnv; // Changed aWETH to kWETH

    expect(await aclManager.connect(deployer.signer).addPoolAdmin(poolAdmin.address));

    expect(await kWETH.getIncentivesController()).to.not.be.eq(ZERO_ADDRESS); // Changed aWETH to kWETH
    expect(await kWETH.connect(poolAdmin.signer).setIncentivesController(ZERO_ADDRESS)); // Changed aWETH to kWETH
    expect(await kWETH.getIncentivesController()).to.be.eq(ZERO_ADDRESS); // Changed aWETH to kWETH

    await evmRevert(snapshot);
  });

  it('setIncentivesController() from not pool admin (revert expected)', async () => {
    const {
      users: [user],
      kWETH, // Changed aWETH to kWETH
    } = testEnv;

    expect(await kWETH.getIncentivesController()).to.not.be.eq(ZERO_ADDRESS); // Changed aWETH to kWETH

    await expect(
      kWETH.connect(user.signer).setIncentivesController(ZERO_ADDRESS) // Changed aWETH to kWETH
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('transfer() amount > MAX_UINT_128', async () => {
    const {
      kDai, // Changed aDai to kDai
      users: [depositor, borrower],
    } = testEnv;

    expect(kDai.transfer(borrower.address, MAX_UINT_AMOUNT)).to.be.revertedWith( // Changed aDai to kDai
      SAFECAST_UINT128_OVERFLOW
    );
  });

  it('setIncentivesController() ', async () => {
    const snapshot = await evmSnapshot();
    const { deployer, poolAdmin, kWETH, aclManager } = testEnv; // Changed aWETH to kWETH

    expect(await aclManager.connect(deployer.signer).addPoolAdmin(poolAdmin.address));

    expect(await kWETH.getIncentivesController()).to.not.be.eq(ZERO_ADDRESS); // Changed aWETH to kWETH
    expect(await kWETH.connect(poolAdmin.signer).setIncentivesController(ZERO_ADDRESS)); // Changed aWETH to kWETH
    expect(await kWETH.getIncentivesController()).to.be.eq(ZERO_ADDRESS); // Changed aWETH to kWETH

    await evmRevert(snapshot);
  });

  it('setIncentivesController() from not pool admin (revert expected)', async () => {
    const {
      users: [user],
      kWETH, // Changed aWETH to kWETH
    } = testEnv;

    expect(await kWETH.getIncentivesController()).to.not.be.eq(ZERO_ADDRESS); // Changed aWETH to kWETH

    await expect(
      kWETH.connect(user.signer).setIncentivesController(ZERO_ADDRESS) // Changed aWETH to kWETH
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });
});

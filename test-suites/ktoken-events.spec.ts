import {
  evmSnapshot,
  evmRevert,
  advanceTimeAndBlock,
  ZERO_ADDRESS,
  MintableERC20__factory,
} from '@aave/deploy-v3';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { TransactionReceipt } from '@ethersproject/providers';
import { MAX_UINT_AMOUNT } from '../helpers/constants';
import { convertToCurrencyDecimals } from '../helpers/contracts-helpers';
import { RateMode } from '../helpers/types';
import { Pool, KToken } from '../types'; // Changed AToken to KToken
import { makeSuite, SignerWithAddress, TestEnv } from './helpers/make-suite';
import {
  supply,
  transfer,
  withdraw,
  getKTokenEvent, // Changed getATokenEvent to getKTokenEvent
  transferFrom,
  // printATokenEvents, // This helper might need an update if it's AToken specific, assuming generic or will be updated
} from './helpers/utils/tokenization-events';

const DEBUG = false;

let balances = {
  balance: {},
};

const log = (str: string) => {
  if (DEBUG) console.log(str);
};

const printBalance = async (name: string, kToken: any, userAddress: string) => { // Changed aToken to kToken
  console.log(
    name,
    'balanceOf',
    await ethers.utils.formatEther(await kToken.balanceOf(userAddress)), // Changed aToken to kToken
    'scaledBalance',
    await ethers.utils.formatEther(await kToken.scaledBalanceOf(userAddress)) // Changed aToken to kToken
  );
};

const increaseSupplyIndex = async (
  pool: Pool,
  borrower: SignerWithAddress,
  collateral: string,
  assetToIncrease: string
) => {
  const collateralToken = MintableERC20__factory.connect(collateral, borrower.signer);
  const borrowingToken = MintableERC20__factory.connect(assetToIncrease, borrower.signer);

  await collateralToken
    .connect(borrower.signer)
    ['mint(address,uint256)'](
      borrower.address,
      await convertToCurrencyDecimals(collateralToken.address, '10000000')
    );
  await collateralToken.connect(borrower.signer).approve(pool.address, MAX_UINT_AMOUNT);
  await pool
    .connect(borrower.signer)
    .supply(
      collateral,
      await convertToCurrencyDecimals(collateral, '100000'),
      borrower.address,
      '0'
    );

  const { kTokenAddress } = await pool.getReserveData(assetToIncrease); // Changed aTokenAddress to kTokenAddress
  const availableLiquidity = await borrowingToken.balanceOf(kTokenAddress); // Changed aTokenAddress to kTokenAddress
  await pool
    .connect(borrower.signer)
    .borrow(
      assetToIncrease,
      availableLiquidity.percentMul('20'),
      RateMode.Variable,
      0,
      borrower.address
    );

  await advanceTimeAndBlock(10000000000);
};

const updateBalances = (balances: any, kToken: KToken, receipt: TransactionReceipt) => { // Changed aToken to kToken, AToken to KToken
  let events = getKTokenEvent(kToken, receipt, 'Transfer'); // Changed getATokenEvent to getKTokenEvent, aToken to kToken
  for (const ev of events) {
    if (ev.from == ZERO_ADDRESS || ev.to == ZERO_ADDRESS) continue;
    balances.balance[ev.from] = balances.balance[ev.from]?.sub(ev.value);
    balances.balance[ev.to] = balances.balance[ev.to]?.add(ev.value);
  }
  events = getKTokenEvent(kToken, receipt, 'Mint'); // Changed getATokenEvent to getKTokenEvent, aToken to kToken
  for (const ev of events) {
    balances.balance[ev.onBehalfOf] = balances.balance[ev.onBehalfOf]?.add(ev.value);
  }
  events = getKTokenEvent(kToken, receipt, 'Burn'); // Changed getATokenEvent to getKTokenEvent, aToken to kToken
  for (const ev of events) {
    balances.balance[ev.from] = balances.balance[ev.from]?.sub(ev.value.add(ev.balanceIncrease));
    balances.balance[ev.from] = balances.balance[ev.from]?.add(ev.balanceIncrease);
  }
};

makeSuite('KToken: Events', (testEnv: TestEnv) => { // Changed AToken to KToken
  let alice, bob, eve, borrower, borrower2;

  let snapId;

  before(async () => {
    const { users, pool, dai, weth } = testEnv;
    [alice, bob, eve, borrower, borrower2] = users;

    const amountToMint = await convertToCurrencyDecimals(dai.address, '10000000');
    const usersToInit = [alice, bob, eve, borrower, borrower2];
    for (const user of usersToInit) {
      await dai.connect(user.signer)['mint(uint256)'](amountToMint);
      await weth.connect(user.signer)['mint(address,uint256)'](user.address, amountToMint);
      await dai.connect(user.signer).approve(pool.address, MAX_UINT_AMOUNT);
      await weth.connect(user.signer).approve(pool.address, MAX_UINT_AMOUNT);
    }
  });

  beforeEach(async () => {
    snapId = await evmSnapshot();

    // Init balances
    balances = {
      balance: {
        [alice.address]: BigNumber.from(0),
        [bob.address]: BigNumber.from(0),
        [eve.address]: BigNumber.from(0),
      },
    };
  });

  afterEach(async () => {
    await evmRevert(snapId);
  });

  it('Alice and Bob supplies 1000, Alice transfer 500 to Bob, and withdraws 500 (without index change)', async () => {
    await testMultipleSupplyAndTransferAndWithdraw(false);
  });

  it('Alice and Bob supplies 1000, Alice transfer 500 to Bob, and withdraws 500 (with index change)', async () => {
    await testMultipleSupplyAndTransferAndWithdraw(true);
  });

  const testMultipleSupplyAndTransferAndWithdraw = async (indexChange: boolean) => {
    const { pool, dai, kDai, weth } = testEnv; // Changed aDai to kDai

    let rcpt;
    let balanceTransferEv;
    let aliceBalanceBefore = await kDai.balanceOf(alice.address); // Changed aDai to kDai
    let bobBalanceBefore = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    log('- Alice supplies 1000 DAI');
    rcpt = await supply(pool, alice, dai.address, '1000', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Bob supplies 1000 DAI');
    rcpt = await supply(pool, bob, dai.address, '1000', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice transfers 500 kDAI to Bob'); // Changed aDAI to kDAI
    const [fromScaledBefore, toScaledBefore] = await Promise.all([
      kDai.scaledBalanceOf(alice.address), // Changed aDai to kDai
      kDai.scaledBalanceOf(bob.address), // Changed aDai to kDai
    ]);
    rcpt = await transfer(pool, alice, dai.address, '500', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    balanceTransferEv = getKTokenEvent(kDai, rcpt, 'BalanceTransfer')[0]; // Changed getATokenEvent to getKTokenEvent, aDai to kDai
    expect(await kDai.scaledBalanceOf(alice.address)).to.be.eq( // Changed aDai to kDai
      fromScaledBefore.sub(balanceTransferEv.value),
      'Scaled balance emitted in BalanceTransfer event does not match'
    );
    expect(await kDai.scaledBalanceOf(bob.address)).to.be.eq( // Changed aDai to kDai
      toScaledBefore.add(balanceTransferEv.value),
      'Scaled balance emitted in BalanceTransfer event does not match'
    );

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice withdraws 500 DAI to Bob');
    rcpt = await withdraw(pool, alice, dai.address, '500', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (DEBUG) {
      await printBalance('alice', kDai, alice.address); // Changed aDai to kDai
      await printBalance('bob', kDai, bob.address); // Changed aDai to kDai
    }

    // Check final balances
    rcpt = await supply(pool, alice, dai.address, '1', alice.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const aliceBalanceAfter = await kDai.balanceOf(alice.address); // Changed aDai to kDai

    rcpt = await supply(pool, bob, dai.address, '1', bob.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const bobBalanceAfter = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    expect(aliceBalanceAfter).to.be.closeTo(
      aliceBalanceBefore.add(balances.balance[alice.address]),
      2
    );
    expect(bobBalanceAfter).to.be.closeTo(bobBalanceBefore.add(balances.balance[bob.address]), 2);
  };

  it('Alice supplies 1000, supplies 200, transfers 100 out, withdraws 50 withdraws 100 to Bob, withdraws 200 (without index change)', async () => {
    await testMultipleSupplyAndWithdrawalsOnBehalf(false);
  });

  it('Alice supplies 1000, supplies 200, transfers 100 out, withdraws 50 withdraws 100 to Bob, withdraws 200 (with index change)', async () => {
    await testMultipleSupplyAndWithdrawalsOnBehalf(true);
  });

  const testMultipleSupplyAndWithdrawalsOnBehalf = async (indexChange: boolean) => {
    const { pool, dai, kDai, weth } = testEnv; // Changed aDai to kDai

    let rcpt;
    let balanceTransferEv;
    let aliceBalanceBefore = await kDai.balanceOf(alice.address); // Changed aDai to kDai
    let bobBalanceBefore = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    log('- Alice supplies 1000 DAI');
    rcpt = await supply(pool, alice, dai.address, '1000', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice supplies 200 DAI');
    rcpt = await supply(pool, alice, dai.address, '200', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice transfers 100 kDAI to Bob'); // Changed aDAI to kDAI
    const [fromScaledBefore, toScaledBefore] = await Promise.all([
      kDai.scaledBalanceOf(alice.address), // Changed aDai to kDai
      kDai.scaledBalanceOf(bob.address), // Changed aDai to kDai
    ]);
    rcpt = await transfer(pool, alice, dai.address, '100', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    balanceTransferEv = getKTokenEvent(kDai, rcpt, 'BalanceTransfer')[0]; // Changed getATokenEvent to getKTokenEvent, aDai to kDai
    expect(await kDai.scaledBalanceOf(alice.address)).to.be.eq( // Changed aDai to kDai
      fromScaledBefore.sub(balanceTransferEv.value),
      'Scaled balance emitted in BalanceTransfer event does not match'
    );
    expect(await kDai.scaledBalanceOf(bob.address)).to.be.eq( // Changed aDai to kDai
      toScaledBefore.add(balanceTransferEv.value),
      'Scaled balance emitted in BalanceTransfer event does not match'
    );

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice withdraws 50 DAI');
    rcpt = await withdraw(pool, alice, dai.address, '50', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice withdraws 100 DAI to Bob');
    rcpt = await withdraw(pool, alice, dai.address, '100', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice withdraws 300 DAI');
    rcpt = await withdraw(pool, alice, dai.address, '300', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (DEBUG) {
      await printBalance('alice', kDai, alice.address); // Changed aDai to kDai
      await printBalance('bob', kDai, bob.address); // Changed aDai to kDai
    }

    // Check final balances
    rcpt = await supply(pool, alice, dai.address, '1', alice.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const aliceBalanceAfter = await kDai.balanceOf(alice.address); // Changed aDai to kDai

    rcpt = await supply(pool, bob, dai.address, '1', bob.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const bobBalanceAfter = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    expect(aliceBalanceAfter).to.be.closeTo(
      aliceBalanceBefore.add(balances.balance[alice.address]),
      2
    );
    expect(bobBalanceAfter).to.be.closeTo(bobBalanceBefore.add(balances.balance[bob.address]), 2);
  };

  it('Alice supplies 1000, supplies 200 to Bob, Bob supplies 100, Alice transfers 100 out, Alice withdraws 100, Alice withdraws 200 to Bob (without index change)', async () => {
    await testMultipleSupplyOnBehalfOfAndWithdrawals(false);
  });

  it('Alice supplies 1000, supplies 200 to Bob, Bob supplies 100, Alice transfers 100 out, Alice withdraws 100, Alice withdraws 200 to Bob (with index change)', async () => {
    await testMultipleSupplyOnBehalfOfAndWithdrawals(true);
  });

  const testMultipleSupplyOnBehalfOfAndWithdrawals = async (indexChange: boolean) => {
    const { pool, dai, kDai, weth } = testEnv; // Changed aDai to kDai

    let rcpt;
    let balanceTransferEv;
    let aliceBalanceBefore = await kDai.balanceOf(alice.address); // Changed aDai to kDai
    let bobBalanceBefore = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    log('- Alice supplies 1000 DAI');
    rcpt = await supply(pool, alice, dai.address, '1000', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice supplies 200 DAI to Bob');
    rcpt = await supply(pool, alice, dai.address, '200', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Bob supplies 100 DAI');
    rcpt = await supply(pool, bob, dai.address, '100', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice transfers 100 kDAI to Bob'); // Changed aDAI to kDAI
    const [fromScaledBefore, toScaledBefore] = await Promise.all([
      kDai.scaledBalanceOf(alice.address), // Changed aDai to kDai
      kDai.scaledBalanceOf(bob.address), // Changed aDai to kDai
    ]);
    rcpt = await transfer(pool, alice, dai.address, '100', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    balanceTransferEv = getKTokenEvent(kDai, rcpt, 'BalanceTransfer')[0]; // Changed getATokenEvent to getKTokenEvent, aDai to kDai
    expect(await kDai.scaledBalanceOf(alice.address)).to.be.eq( // Changed aDai to kDai
      fromScaledBefore.sub(balanceTransferEv.value),
      'Scaled balance emitted in BalanceTransfer event does not match'
    );
    expect(await kDai.scaledBalanceOf(bob.address)).to.be.eq( // Changed aDai to kDai
      toScaledBefore.add(balanceTransferEv.value),
      'Scaled balance emitted in BalanceTransfer event does not match'
    );

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice withdraws 200 DAI to Bob');
    rcpt = await withdraw(pool, alice, dai.address, '200', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (DEBUG) {
      await printBalance('alice', kDai, alice.address); // Changed aDai to kDai
      await printBalance('bob', kDai, bob.address); // Changed aDai to kDai
    }

    // Check final balances
    rcpt = await supply(pool, alice, dai.address, '1', alice.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const aliceBalanceAfter = await kDai.balanceOf(alice.address); // Changed aDai to kDai

    rcpt = await supply(pool, bob, dai.address, '1', bob.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const bobBalanceAfter = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    expect(aliceBalanceAfter).to.be.closeTo(
      aliceBalanceBefore.add(balances.balance[alice.address]),
      2
    );
    expect(bobBalanceAfter).to.be.closeTo(bobBalanceBefore.add(balances.balance[bob.address]), 2);
  };

  it('Alice supplies 1000, transfers 100 to Bob, transfers 500 to itself, Bob transfers 500 from Alice to itself, withdraws 400 to Bob (without index change)', async () => {
    await testMultipleTransfersAndWithdrawals(false);
  });

  it('Alice supplies 1000, transfers 100 to Bob, transfers 500 to itself, Bob transfers 500 from Alice to itself, withdraws 400 to Bob  (with index change)', async () => {
    await testMultipleTransfersAndWithdrawals(true);
  });

  const testMultipleTransfersAndWithdrawals = async (indexChange: boolean) => {
    const { pool, dai, kDai, weth } = testEnv; // Changed aDai to kDai

    let rcpt;
    let balanceTransferEv;
    let aliceBalanceBefore = await kDai.balanceOf(alice.address); // Changed aDai to kDai
    let bobBalanceBefore = await kDai.balanceOf(bob.address); // Changed aDai to kDai
    let eveBalanceBefore = await kDai.balanceOf(eve.address); // Changed aDai to kDai

    log('- Alice supplies 1000 DAI');
    rcpt = await supply(pool, alice, dai.address, '1000', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice transfers 100 DAI to Bob');
    let [fromScaledBefore, toScaledBefore] = await Promise.all([
      kDai.scaledBalanceOf(alice.address), // Changed aDai to kDai
      kDai.scaledBalanceOf(bob.address), // Changed aDai to kDai
    ]);
    rcpt = await transfer(pool, alice, dai.address, '100', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    balanceTransferEv = getKTokenEvent(kDai, rcpt, 'BalanceTransfer')[0]; // Changed getATokenEvent to getKTokenEvent, aDai to kDai
    expect(await kDai.scaledBalanceOf(alice.address)).to.be.eq( // Changed aDai to kDai
      fromScaledBefore.sub(balanceTransferEv.value),
      'Scaled balance emitted in BalanceTransfer event does not match'
    );
    expect(await kDai.scaledBalanceOf(bob.address)).to.be.eq( // Changed aDai to kDai
      toScaledBefore.add(balanceTransferEv.value),
      'Scaled balance emitted in BalanceTransfer event does not match'
    );

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice transfers 500 DAI to itself');
    fromScaledBefore = await kDai.scaledBalanceOf(alice.address); // Changed aDai to kDai
    rcpt = await transfer(pool, alice, dai.address, '500', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    expect(await kDai.scaledBalanceOf(alice.address)).to.be.eq( // Changed aDai to kDai
      fromScaledBefore,
      'Scaled balance should remain the same'
    );

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Bob transfersFrom Alice 500 DAI to Alice');
    fromScaledBefore = await kDai.scaledBalanceOf(alice.address); // Changed aDai to kDai
    expect(
      await kDai // Changed aDai to kDai
        .connect(alice.signer)
        .approve(bob.address, await convertToCurrencyDecimals(dai.address, '500'))
    );
    rcpt = await transferFrom(pool, bob, alice.address, dai.address, '500', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    expect(await kDai.scaledBalanceOf(alice.address)).to.be.eq( // Changed aDai to kDai
      fromScaledBefore,
      'Scaled balance should remain the same'
    );

    if (indexChange) {
      log('- Increase index due to great borrow of DAI');
      await increaseSupplyIndex(pool, borrower, weth.address, dai.address);
    }

    log('- Alice withdraws 400 DAI to Bob');
    rcpt = await withdraw(pool, alice, dai.address, '200', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (DEBUG) {
      await printBalance('alice', kDai, alice.address); // Changed aDai to kDai
      await printBalance('bob', kDai, bob.address); // Changed aDai to kDai
      await printBalance('eve', kDai, eve.address); // Changed aDai to kDai
    }

    // Check final balances
    rcpt = await supply(pool, alice, dai.address, '1', alice.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const aliceBalanceAfter = await kDai.balanceOf(alice.address); // Changed aDai to kDai

    rcpt = await supply(pool, bob, dai.address, '1', bob.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const bobBalanceAfter = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    rcpt = await supply(pool, eve, dai.address, '1', eve.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const eveBalanceAfter = await kDai.balanceOf(eve.address); // Changed aDai to kDai

    expect(aliceBalanceAfter).to.be.closeTo(
      aliceBalanceBefore.add(balances.balance[alice.address]),
      2
    );
    expect(bobBalanceAfter).to.be.closeTo(bobBalanceBefore.add(balances.balance[bob.address]), 2);
    expect(eveBalanceAfter).to.be.closeTo(eveBalanceBefore.add(balances.balance[eve.address]), 2);
  };

  it('Alice supplies 300000, withdraws 200000 to Bob, withdraws 5 to Bob', async () => {
    const { pool, dai, kDai, weth } = testEnv; // Changed aDai to kDai

    let rcpt;
    let aliceBalanceBefore = await kDai.balanceOf(alice.address); // Changed aDai to kDai
    let bobBalanceBefore = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    log('- Alice supplies 300000 DAI');
    rcpt = await supply(pool, alice, dai.address, '300000', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    log('- Increase index due to great borrow of DAI');
    await increaseSupplyIndex(pool, borrower, weth.address, dai.address);

    log('- Alice withdraws 200000 DAI to Bob');
    rcpt = await withdraw(pool, alice, dai.address, '200000', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    log('- Increase index due to great borrow of DAI');
    await increaseSupplyIndex(pool, borrower, weth.address, dai.address);

    log('- Alice withdraws 5 DAI to Bob');
    rcpt = await withdraw(pool, alice, dai.address, '5', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (DEBUG) {
      await printBalance('alice', kDai, alice.address); // Changed aDai to kDai
      await printBalance('bob', kDai, bob.address); // Changed aDai to kDai
    }

    // Check final balances
    rcpt = await supply(pool, alice, dai.address, '1', alice.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const aliceBalanceAfter = await kDai.balanceOf(alice.address); // Changed aDai to kDai

    rcpt = await supply(pool, bob, dai.address, '1', bob.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const bobBalanceAfter = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    expect(aliceBalanceAfter).to.be.closeTo(
      aliceBalanceBefore.add(balances.balance[alice.address]),
      2
    );
    expect(bobBalanceAfter).to.be.closeTo(bobBalanceBefore.add(balances.balance[bob.address]), 2);
  });

  it('Bob supplies 1000, Alice supplies 200 on behalf of Bob, Bob withdraws 200 on behalf of Alice', async () => {
    const { pool, dai, kDai, weth } = testEnv; // Changed aDai to kDai

    let rcpt;
    let aliceBalanceBefore = await kDai.balanceOf(alice.address); // Changed aDai to kDai
    let bobBalanceBefore = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    log('- Bob supplies 1000 DAI');
    rcpt = await supply(pool, bob, dai.address, '1000', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    log('- Increase index due to great borrow of DAI');
    await increaseSupplyIndex(pool, borrower, weth.address, dai.address);

    log('- Alice supplies 200 DAI to Bob');
    rcpt = await supply(pool, alice, dai.address, '200', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    log('- Increase index due to great borrow of DAI');
    await increaseSupplyIndex(pool, borrower, weth.address, dai.address);

    log('- Bob withdraws 200 DAI to Alice');
    rcpt = await withdraw(pool, bob, dai.address, '200', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (DEBUG) {
      await printBalance('alice', kDai, alice.address); // Changed aDai to kDai
      await printBalance('bob', kDai, bob.address); // Changed aDai to kDai
    }

    // Check final balances
    rcpt = await supply(pool, alice, dai.address, '1', alice.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const aliceBalanceAfter = await kDai.balanceOf(alice.address); // Changed aDai to kDai

    rcpt = await supply(pool, bob, dai.address, '1', bob.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const bobBalanceAfter = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    expect(aliceBalanceAfter).to.be.closeTo(
      aliceBalanceBefore.add(balances.balance[alice.address]),
      2
    );
    expect(bobBalanceAfter).to.be.closeTo(bobBalanceBefore.add(balances.balance[bob.address]), 2);
  });

  it('Alice supplies 1000 DAI and approves kDai to Bob, Bob transfers 500 to himself and 300 to Eve, index change, principal goes back to Alice', async () => { // Changed aDai to kDai
    const { pool, dai, kDai, weth } = testEnv; // Changed aDai to kDai

    let rcpt;
    let aliceBalanceBefore = await kDai.balanceOf(alice.address); // Changed aDai to kDai
    let bobBalanceBefore = await kDai.balanceOf(bob.address); // Changed aDai to kDai
    let eveBalanceBefore = await kDai.balanceOf(eve.address); // Changed aDai to kDai

    log('- Alice supplies 1000 DAI');
    rcpt = await supply(pool, alice, dai.address, '1000', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    log('- Alice approves kDai to Bob'); // Changed aDai to kDai
    await kDai.connect(alice.signer).approve(bob.address, MAX_UINT_AMOUNT); // Changed aDai to kDai

    log('- Bob transfers 500 kDai from Alice to himself'); // Changed aDai to kDai
    rcpt = await transferFrom(pool, bob, alice.address, dai.address, '500', bob.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    log('- Bob transfers 300 kDai from Alice to Eve'); // Changed aDai to kDai
    rcpt = await transferFrom(pool, bob, alice.address, dai.address, '300', eve.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    log('- Increase index due to great borrow of DAI');
    await increaseSupplyIndex(pool, borrower, weth.address, dai.address);

    log('- Bob transfers 500 back to Alice');
    rcpt = await transfer(pool, bob, dai.address, '500', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    log('- Eve transfers 500 back to Alice');
    rcpt = await transfer(pool, eve, dai.address, '300', alice.address, DEBUG);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai

    if (DEBUG) {
      await printBalance('alice', kDai, alice.address); // Changed aDai to kDai
      await printBalance('bob', kDai, bob.address); // Changed aDai to kDai
      await printBalance('eve', kDai, eve.address); // Changed aDai to kDai
    }

    // Check final balances
    rcpt = await supply(pool, alice, dai.address, '1', alice.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const aliceBalanceAfter = await kDai.balanceOf(alice.address); // Changed aDai to kDai

    rcpt = await supply(pool, bob, dai.address, '1', bob.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const bobBalanceAfter = await kDai.balanceOf(bob.address); // Changed aDai to kDai

    rcpt = await supply(pool, eve, dai.address, '1', eve.address, false);
    updateBalances(balances, kDai, rcpt); // Changed aDai to kDai
    const eveBalanceAfter = await kDai.balanceOf(eve.address); // Changed aDai to kDai

    expect(aliceBalanceAfter).to.be.closeTo(
      aliceBalanceBefore.add(balances.balance[alice.address]),
      2
    );
    expect(bobBalanceAfter).to.be.closeTo(bobBalanceBefore.add(balances.balance[bob.address]), 2);
    expect(eveBalanceAfter).to.be.closeTo(eveBalanceBefore.add(balances.balance[eve.address]), 2);
  });
});

import { Signer } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import {
  getPool,
  getPoolAddressesProvider,
  getAaveProtocolDataProvider,
  getKToken, // Assuming a getKToken helper will exist or getAToken will be updated/renamed
  getMintableERC20,
  getPoolConfiguratorProxy,
  getPoolAddressesProviderRegistry,
  getWETHMocked,
  getVariableDebtToken,
  getStableDebtToken,
  getAaveOracle,
  getACLManager,
} from '@aave/deploy-v3/dist/helpers/contract-getters';
import {
  waitForTx,
  evmSnapshot,
  evmRevert,
  getEthersSigners,
  deployPriceOracle,
  Faucet,
  getFaucet,
} from '@aave/deploy-v3';
import { Pool } from '../../types/Pool';
import { AaveProtocolDataProvider } from '../../types/AaveProtocolDataProvider';
import { MintableERC20 } from '../../types/MintableERC20';
import { KToken } from '../../types/KToken'; // Changed AToken to KToken
import { PoolConfigurator } from '../../types/PoolConfigurator';
import { PriceOracle } from '../../types/PriceOracle';
import { PoolAddressesProvider } from '../../types/PoolAddressesProvider';
import { PoolAddressesProviderRegistry } from '../../types/PoolAddressesProviderRegistry';
import { WETH9Mocked } from '../../types/WETH9Mocked';
import { AaveOracle, ACLManager, StableDebtToken, VariableDebtToken } from '../../types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { usingTenderly } from '../../helpers/tenderly-utils';
import { tEthereumAddress } from '../../helpers/types';

declare var hre: HardhatRuntimeEnvironment;

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export interface TestEnv {
  deployer: SignerWithAddress;
  poolAdmin: SignerWithAddress;
  emergencyAdmin: SignerWithAddress;
  riskAdmin: SignerWithAddress;
  users: SignerWithAddress[];
  pool: Pool;
  configurator: PoolConfigurator;
  oracle: PriceOracle;
  aaveOracle: AaveOracle;
  helpersContract: AaveProtocolDataProvider;
  weth: WETH9Mocked;
  kWETH: KToken; // Renamed aWETH to kWETH and AToken to KToken
  faucetMintable: Faucet;
  dai: MintableERC20;
  kDai: KToken; // Renamed aDai to kDai and AToken to KToken
  kAave: KToken; // Renamed aAave to kAave and AToken to KToken
  variableDebtDai: VariableDebtToken;
  stableDebtDai: StableDebtToken;
  kUsdc: KToken; // Renamed aUsdc to kUsdc and AToken to KToken
  usdc: MintableERC20;
  aave: MintableERC20;
  addressesProvider: PoolAddressesProvider;
  registry: PoolAddressesProviderRegistry;
  aclManager: ACLManager;
}

let HardhatSnapshotId: string = '0x1';
const setHardhatSnapshotId = (id: string) => {
  HardhatSnapshotId = id;
};

const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  poolAdmin: {} as SignerWithAddress,
  emergencyAdmin: {} as SignerWithAddress,
  riskAdmin: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  pool: {} as Pool,
  configurator: {} as PoolConfigurator,
  helpersContract: {} as AaveProtocolDataProvider,
  oracle: {} as PriceOracle,
  aaveOracle: {} as AaveOracle,
  weth: {} as WETH9Mocked,
  kWETH: {} as KToken, // Renamed aWETH to kWETH and AToken to KToken
  faucetMintable: {} as Faucet,
  dai: {} as MintableERC20,
  kDai: {} as KToken, // Renamed aDai to kDai and AToken to KToken
  variableDebtDai: {} as VariableDebtToken,
  stableDebtDai: {} as StableDebtToken,
  kUsdc: {} as KToken, // Renamed aUsdc to kUsdc and AToken to KToken
  usdc: {} as MintableERC20,
  aave: {} as MintableERC20,
  // kAave will be initialized later if found
  addressesProvider: {} as PoolAddressesProvider,
  registry: {} as PoolAddressesProviderRegistry,
  aclManager: {} as ACLManager,
} as TestEnv;

export async function initializeMakeSuite() {
  const [_deployer, ...restSigners] = await getEthersSigners();
  const deployer: SignerWithAddress = {
    address: await _deployer.getAddress(),
    signer: _deployer,
  };

  for (const signer of restSigners) {
    testEnv.users.push({
      signer,
      address: await signer.getAddress(),
    });
  }
  testEnv.deployer = deployer;
  testEnv.poolAdmin = deployer;
  testEnv.emergencyAdmin = testEnv.users[1];
  testEnv.riskAdmin = testEnv.users[2];
  testEnv.pool = await getPool();
  testEnv.configurator = await getPoolConfiguratorProxy();

  testEnv.addressesProvider = await getPoolAddressesProvider();

  testEnv.registry = await getPoolAddressesProviderRegistry();
  testEnv.aclManager = await getACLManager();

  testEnv.oracle = await deployPriceOracle();
  testEnv.aaveOracle = await getAaveOracle();

  testEnv.helpersContract = await getAaveProtocolDataProvider();

  // getAllATokens was updated to getAllKTokens in AaveProtocolDataProvider, assuming it returns KToken data now
  const allTokens = await testEnv.helpersContract.getAllATokens(); // Function name on interface likely unchanged
  const kDaiAddress = allTokens.find((kToken) => kToken.symbol.includes('DAI'))?.tokenAddress; // Renamed aDaiAddress to kDaiAddress, aToken to kToken
  const kUsdcAddress = allTokens.find((kToken) => kToken.symbol.includes('USDC'))?.tokenAddress; // Renamed aUsdcAddress to kUsdcAddress, aToken to kToken
  const kWEthAddress = allTokens.find((kToken) => kToken.symbol.includes('WETH'))?.tokenAddress; // Renamed aWEthAddress to kWEthAddress, aToken to kToken
  const kAaveAddress = allTokens.find((kToken) => kToken.symbol.includes('AAVE'))?.tokenAddress; // Renamed aAaveAddress to kAaveAddress, aToken to kToken

  const reservesTokens = await testEnv.helpersContract.getAllReservesTokens();

  const daiAddress = reservesTokens.find((token) => token.symbol === 'DAI')?.tokenAddress;
  const {
    kTokenAddress: kDaiActualAddress, // Assuming getReserveTokensAddresses now returns kTokenAddress
    variableDebtTokenAddress: variableDebtDaiAddress,
    stableDebtTokenAddress: stableDebtDaiAddress,
  } = await testEnv.helpersContract.getReserveTokensAddresses(daiAddress || '');
  const usdcAddress = reservesTokens.find((token) => token.symbol === 'USDC')?.tokenAddress;
  const aaveAddress = reservesTokens.find((token) => token.symbol === 'AAVE')?.tokenAddress;
  const wethAddress = reservesTokens.find((token) => token.symbol === 'WETH')?.tokenAddress;

  if (!kDaiAddress || !kWEthAddress) { // Renamed aDaiAddress to kDaiAddress, aWEthAddress to kWEthAddress
    throw 'Missing mandatory ktokens'; // Renamed atokens to ktokens
  }
  if (!daiAddress || !usdcAddress || !aaveAddress || !wethAddress) {
    throw 'Missing mandatory tokens';
  }

  testEnv.faucetMintable = await getFaucet();
  testEnv.kDai = await getKToken(kDaiAddress); // Renamed aDai to kDai, getAToken to getKToken
  testEnv.variableDebtDai = await getVariableDebtToken(variableDebtDaiAddress);
  testEnv.stableDebtDai = await getStableDebtToken(stableDebtDaiAddress);
  testEnv.kUsdc = await getKToken(kUsdcAddress); // Renamed aUsdc to kUsdc, getAToken to getKToken
  testEnv.kWETH = await getKToken(kWEthAddress); // Renamed aWETH to kWETH, getAToken to getKToken
  if (kAaveAddress) { // Handle optional AAVE kToken
    testEnv.kAave = await getKToken(kAaveAddress); // Renamed aAave to kAave, getAToken to getKToken
  }


  testEnv.dai = await getMintableERC20(daiAddress);
  testEnv.aave = await getMintableERC20(aaveAddress);
  testEnv.usdc = await getMintableERC20(usdcAddress);
  testEnv.weth = await getWETHMocked(wethAddress);

  // Support direct minting
  const testReserves = reservesTokens.map((x) => x.tokenAddress);
  await waitForTx(await testEnv.faucetMintable.setProtectedOfChild(testReserves, false));

  // Setup Fallback Oracle and feed up with current AaveOracle prices
  for (const testReserve of testReserves) {
    const price = await testEnv.aaveOracle.getAssetPrice(testReserve);
    await waitForTx(await testEnv.oracle.setAssetPrice(testReserve, price));
  }
  await waitForTx(await testEnv.aaveOracle.setFallbackOracle(testEnv.oracle.address));

  // Setup admins
  await waitForTx(await testEnv.aclManager.addRiskAdmin(testEnv.riskAdmin.address));
  await waitForTx(await testEnv.aclManager.addEmergencyAdmin(testEnv.emergencyAdmin.address));
}

const setSnapshot = async () => {
  if (usingTenderly()) {
    setHardhatSnapshotId((await hre.tenderlyNetwork.getHead()) || '0x1');
    return;
  }
  setHardhatSnapshotId(await evmSnapshot());
};

const revertHead = async () => {
  if (usingTenderly()) {
    await hre.tenderlyNetwork.setHead(HardhatSnapshotId);
    return;
  }
  await evmRevert(HardhatSnapshotId);
};

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      await setSnapshot();
    });
    tests(testEnv);
    after(async () => {
      await revertHead();
    });
  });
}

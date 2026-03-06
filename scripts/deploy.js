const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const INITIAL_SUPPLY = 1_000_000_000;     // 1 billion USDT
  const DEFAULT_FLASH_TTL = 86400;          // 24 hours (seconds)
  const GAS_WALLET = deployer.address;      // gas fees go to deployer
  const FLASH_GAS_FEE = 1_000_000;          // 1 USDT per flash (6 decimals)

  console.log("Deploying FlashUSDT with account:", deployer.address);

  const FlashUSDT = await hre.ethers.getContractFactory("FlashUSDT");
  const flashUSDT = await FlashUSDT.deploy(
    INITIAL_SUPPLY,
    DEFAULT_FLASH_TTL,
    GAS_WALLET,
    FLASH_GAS_FEE
  );

  await flashUSDT.waitForDeployment();

  const address = await flashUSDT.getAddress();
  const name = await flashUSDT.name();
  const symbol = await flashUSDT.symbol();
  const decimals = await flashUSDT.decimals();
  const totalSupply = await flashUSDT.totalSupply();
  const ttl = await flashUSDT.defaultFlashTTL();
  const gasW = await flashUSDT.gasWallet();
  const gasFee = await flashUSDT.flashGasFee();

  console.log("────────────────────────────────────────────────");
  console.log("  FlashUSDT deployed successfully!");
  console.log("────────────────────────────────────────────────");
  console.log(`  Contract:     ${address}`);
  console.log(`  Name:         ${name}`);
  console.log(`  Symbol:       ${symbol}`);
  console.log(`  Decimals:     ${decimals}`);
  console.log(`  Total Supply: ${hre.ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
  console.log(`  Flash TTL:    ${ttl} seconds`);
  console.log(`  Gas Wallet:   ${gasW}`);
  console.log(`  Gas Fee:      ${hre.ethers.formatUnits(gasFee, decimals)} ${symbol}`);
  console.log("────────────────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

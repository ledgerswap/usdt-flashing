/**
 * FlashUSDT — Full Scenario Script
 * 
 * Deploys the contract on a forked/local Hardhat node and executes
 * every feature end-to-end with real transactions, printing a
 * detailed log of each step.
 *
 * Run:  npx hardhat run scripts/scenario.js --network localhost
 *   or: npx hardhat run scripts/scenario.js   (in-process node)
 */

const hre = require("hardhat");
const { ethers } = hre;

// ── Helpers ───────────────────────────────────────────────────────
const USDT = (n) => ethers.parseUnits(String(n), 6);       // human → raw
const fmt  = (v) => ethers.formatUnits(v, 6);              // raw → human
const line = () => console.log("─".repeat(60));
const header = (title) => { line(); console.log(`  ⚡ ${title}`); line(); };
const ok = (msg) => console.log(`  ✅  ${msg}`);
const info = (msg) => console.log(`  ℹ️   ${msg}`);
const warn = (msg) => console.log(`  ⚠️   ${msg}`);

let passCount = 0;
let failCount = 0;

function assert(condition, label) {
  if (condition) {
    ok(label);
    passCount++;
  } else {
    console.log(`  ❌  FAIL: ${label}`);
    failCount++;
  }
}

async function mineSeconds(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

// ── Main Scenario ─────────────────────────────────────────────────
async function main() {
  const signers = await ethers.getSigners();
  const [owner, alice, bob, charlie, dexRouter, gasCollector] = signers;

  console.log("\n");
  header("DEPLOYING FlashUSDT");

  const INITIAL_SUPPLY = 1_000_000_000;
  const DEFAULT_TTL = 3600; // 1 hour
  const GAS_FEE = USDT(1); // 1 USDT

  const Factory = await ethers.getContractFactory("FlashUSDT");
  const token = await Factory.deploy(INITIAL_SUPPLY, DEFAULT_TTL, gasCollector.address, GAS_FEE);
  await token.waitForDeployment();

  const addr = await token.getAddress();
  info(`Contract deployed at: ${addr}`);
  info(`Owner:       ${owner.address}`);
  info(`Alice:       ${alice.address}`);
  info(`Bob:         ${bob.address}`);
  info(`Charlie:     ${charlie.address}`);
  info(`DEX Router:  ${dexRouter.address}`);
  info(`Gas Wallet:  ${gasCollector.address}`);

  // ────────────────────────────────────────────────────────────────
  header("1. TOKEN METADATA");
  // ────────────────────────────────────────────────────────────────
  assert((await token.name()) === "Tether USD", "Name is 'Tether USD'");
  assert((await token.symbol()) === "USDT", "Symbol is 'USDT'");
  assert((await token.decimals()) === 6n, "Decimals = 6");
  assert((await token.totalSupply()) === USDT(INITIAL_SUPPLY), `Total supply = ${INITIAL_SUPPLY} USDT`);
  assert((await token.balanceOf(owner.address)) === USDT(INITIAL_SUPPLY), "Owner holds entire supply");

  // ────────────────────────────────────────────────────────────────
  header("2. BASIC ERC-20 TRANSFERS");
  // ────────────────────────────────────────────────────────────────
  await token.transfer(alice.address, USDT(10000));
  assert((await token.balanceOf(alice.address)) === USDT(10000), "Owner → Alice: 10,000 USDT");

  await token.connect(alice).transfer(bob.address, USDT(2000));
  assert((await token.balanceOf(bob.address)) === USDT(2000), "Alice → Bob: 2,000 USDT");
  assert((await token.balanceOf(alice.address)) === USDT(8000), "Alice balance = 8,000 USDT");

  // approve + transferFrom
  await token.connect(bob).approve(alice.address, USDT(500));
  await token.connect(alice).transferFrom(bob.address, charlie.address, USDT(500));
  assert((await token.balanceOf(charlie.address)) === USDT(500), "Bob → Charlie via Alice (transferFrom): 500 USDT");
  ok("Basic ERC-20 transfers working");

  // ────────────────────────────────────────────────────────────────
  header("3. MINTING NEW TOKENS");
  // ────────────────────────────────────────────────────────────────
  const supplyBefore = await token.totalSupply();
  await token.mint(alice.address, USDT(5000));
  assert((await token.balanceOf(alice.address)) === USDT(13000), "Minted 5,000 → Alice (now 13,000)");
  assert((await token.totalSupply()) === supplyBefore + USDT(5000), "Total supply increased by 5,000");

  // Non-owner cannot mint
  try {
    await token.connect(alice).mint(alice.address, USDT(1));
    assert(false, "Non-owner mint should revert");
  } catch {
    ok("Non-owner mint correctly reverted");
  }

  // ────────────────────────────────────────────────────────────────
  header("4. BURNING / DESTROY TOKENS");
  // ────────────────────────────────────────────────────────────────
  await token.destroy(alice.address, USDT(1000));
  assert((await token.balanceOf(alice.address)) === USDT(12000), "Owner destroyed 1,000 from Alice (now 12,000)");

  // Self-burn
  await token.connect(alice).burn(USDT(500));
  assert((await token.balanceOf(alice.address)) === USDT(11500), "Alice self-burned 500 (now 11,500)");

  // ────────────────────────────────────────────────────────────────
  header("5. PAUSE / UNPAUSE");
  // ────────────────────────────────────────────────────────────────
  await token.pause();
  assert((await token.paused()) === true, "Contract is paused");

  try {
    await token.connect(alice).transfer(bob.address, USDT(100));
    assert(false, "Transfer while paused should revert");
  } catch {
    ok("Transfer blocked while paused");
  }

  await token.unpause();
  assert((await token.paused()) === false, "Contract is unpaused");
  await token.connect(alice).transfer(bob.address, USDT(100));
  ok("Transfer works after unpause");

  // ────────────────────────────────────────────────────────────────
  header("6. BLACKLIST");
  // ────────────────────────────────────────────────────────────────
  await token.blacklist(charlie.address);
  assert((await token.isBlacklisted(charlie.address)) === true, "Charlie is blacklisted");

  try {
    await token.connect(charlie).transfer(alice.address, USDT(100));
    assert(false, "Blacklisted sender should fail");
  } catch {
    ok("Blacklisted sender transfer blocked");
  }

  try {
    await token.connect(alice).transfer(charlie.address, USDT(100));
    assert(false, "Transfer to blacklisted should fail");
  } catch {
    ok("Transfer to blacklisted address blocked");
  }

  await token.unBlacklist(charlie.address);
  assert((await token.isBlacklisted(charlie.address)) === false, "Charlie un-blacklisted");
  await token.connect(charlie).transfer(alice.address, USDT(100));
  ok("Charlie can transfer after un-blacklist");

  // ────────────────────────────────────────────────────────────────
  header("7. DEX / SWAP BLOCKING");
  // ────────────────────────────────────────────────────────────────
  await token.blockDEX(dexRouter.address);
  assert((await token.isDEXBlocked(dexRouter.address)) === true, "DEX router is blocked");

  try {
    await token.connect(alice).transfer(dexRouter.address, USDT(100));
    assert(false, "Transfer to DEX should fail");
  } catch {
    ok("Transfer to DEX-blocked address blocked");
  }

  // Fund dexRouter to test outbound blocking
  await token.unblockDEX(dexRouter.address);
  await token.transfer(dexRouter.address, USDT(500));
  await token.blockDEX(dexRouter.address);

  try {
    await token.connect(dexRouter).transfer(alice.address, USDT(100));
    assert(false, "Transfer from DEX should fail");
  } catch {
    ok("Transfer from DEX-blocked address blocked");
  }

  await token.unblockDEX(dexRouter.address);
  await token.connect(dexRouter).transfer(alice.address, USDT(500));
  ok("DEX unblocked — transfer works");

  // ────────────────────────────────────────────────────────────────
  header("8. GAS WALLET CONFIGURATION");
  // ────────────────────────────────────────────────────────────────
  info(`Current gas wallet: ${await token.gasWallet()}`);
  info(`Current gas fee: ${fmt(await token.flashGasFee())} USDT`);

  const newGasWallet = signers[7].address;
  await token.setGasWallet(newGasWallet);
  assert((await token.gasWallet()) === newGasWallet, `Gas wallet changed to ${newGasWallet.slice(0,8)}...`);

  await token.setGasFee(USDT(2));
  assert((await token.flashGasFee()) === USDT(2), "Gas fee set to 2 USDT");

  // Reset for further tests
  await token.setGasWallet(gasCollector.address);
  await token.setGasFee(USDT(1));

  try {
    await token.setGasWallet(ethers.ZeroAddress);
    assert(false, "Zero address gas wallet should revert");
  } catch {
    ok("Zero address gas wallet correctly reverted");
  }

  // ────────────────────────────────────────────────────────────────
  header("9. PROGRAMMABLE DECIMALS");
  // ────────────────────────────────────────────────────────────────
  await token.setDecimals(8);
  assert((await token.decimals()) === 8n, "Decimals changed to 8");
  await token.setDecimals(6);
  assert((await token.decimals()) === 6n, "Decimals restored to 6");

  // ────────────────────────────────────────────────────────────────
  header("10. QUOTA SYSTEM");
  // ────────────────────────────────────────────────────────────────
  // Give Alice a flash quota of 5,000 USDT
  await token.setQuota(alice.address, USDT(5000));
  assert((await token.flashQuota(alice.address)) === USDT(5000), "Alice quota = 5,000 USDT");
  assert((await token.remainingQuota(alice.address)) === USDT(5000), "Alice remaining quota = 5,000");

  // Give owner a quota too for later flash tests
  await token.setQuota(owner.address, USDT(100000));
  info("Owner quota set to 100,000 USDT for flash tests");

  // ────────────────────────────────────────────────────────────────
  header("11. FLASH TRANSFER — CORE");
  // ────────────────────────────────────────────────────────────────
  const aliceBalBefore = await token.balanceOf(alice.address);
  const bobBalBefore = await token.balanceOf(bob.address);
  const gasBalBefore = await token.balanceOf(gasCollector.address);

  info(`Alice balance before flash: ${fmt(aliceBalBefore)} USDT`);
  info(`Bob balance before flash:   ${fmt(bobBalBefore)} USDT`);

  // Alice → Bob: flash 3,000 USDT
  const tx1 = await token.connect(alice).flashTransfer(bob.address, USDT(3000));
  const receipt1 = await tx1.wait();

  const aliceBalAfter = await token.balanceOf(alice.address);
  const bobBalAfter = await token.balanceOf(bob.address);
  const gasBalAfter = await token.balanceOf(gasCollector.address);

  info(`Alice balance after flash: ${fmt(aliceBalAfter)} USDT`);
  info(`Bob balance after flash:   ${fmt(bobBalAfter)} USDT`);

  // Alice loses 3000 (flash) + 1 (gas fee) = 3001
  assert(aliceBalBefore - aliceBalAfter === USDT(3001), "Alice charged 3,001 USDT (3,000 + 1 gas fee)");
  assert(bobBalAfter - bobBalBefore === USDT(3000), "Bob received 3,000 USDT (looks real!)");
  assert(gasBalAfter - gasBalBefore === USDT(1), "Gas wallet collected 1 USDT fee");

  // Flash metadata
  const flash0 = await token.getFlashTransfer(0);
  assert(flash0.sender === alice.address, "Flash #0 sender = Alice");
  assert(flash0.recipient === bob.address, "Flash #0 recipient = Bob");
  assert(flash0.amount === USDT(3000), "Flash #0 amount = 3,000");
  assert(flash0.expired === false, "Flash #0 NOT expired yet");
  assert(flash0.reclaimed === false, "Flash #0 NOT reclaimed");

  // Flash balance tracking
  assert((await token.flashBalance(bob.address)) === USDT(3000), "Bob flashBalance = 3,000");
  const bobReal = await token.realBalance(bob.address);
  info(`Bob realBalance = ${fmt(bobReal)} USDT (excludes flash tokens)`);

  // Quota deduction
  assert((await token.remainingQuota(alice.address)) === USDT(2000), "Alice remaining quota = 2,000 after 3,000 flash");

  ok("Flash transfer #0 completed — tokens appear real to Bob");

  // ────────────────────────────────────────────────────────────────
  header("12. FLASH TRANSFER — CUSTOM TTL");
  // ────────────────────────────────────────────────────────────────
  // Owner → Charlie: flash 500 USDT with 120s TTL
  await token.flashTransferWithTTL(charlie.address, USDT(500), 120);
  const flash1 = await token.getFlashTransfer(1);
  assert(flash1.amount === USDT(500), "Flash #1 amount = 500");
  info(`Flash #1 expiresAt = ${flash1.expiresAt.toString()} (custom 120s TTL)`);
  ok("Custom TTL flash transfer #1 created");

  // ────────────────────────────────────────────────────────────────
  header("13. QUOTA ENFORCEMENT");
  // ────────────────────────────────────────────────────────────────
  // Alice has 2,000 remaining. Try to flash 2,500 — should fail.
  try {
    await token.connect(alice).flashTransfer(bob.address, USDT(2500));
    assert(false, "Exceeding quota should revert");
  } catch {
    ok("Flash exceeding quota correctly reverted");
  }

  // Flash exactly 2,000 — should succeed
  await token.connect(alice).flashTransfer(bob.address, USDT(2000));
  assert((await token.remainingQuota(alice.address)) === 0n, "Alice quota fully used (0 remaining)");
  ok("Alice used full quota with 2,000 USDT flash (#2)");

  // ────────────────────────────────────────────────────────────────
  header("14. FLASH NOT RECLAIMABLE BEFORE EXPIRY");
  // ────────────────────────────────────────────────────────────────
  try {
    await token.reclaimFlash(0);
    assert(false, "Reclaim before expiry should revert");
  } catch {
    ok("Reclaim before expiry correctly reverted");
  }

  assert((await token.isFlashExpired(0)) === false, "Flash #0 is NOT expired");

  // ────────────────────────────────────────────────────────────────
  header("15. MANUAL INVALIDATION");
  // ────────────────────────────────────────────────────────────────
  // Invalidate flash #1 (Owner → Charlie, 500 USDT)
  await token.invalidateFlash(1);
  const flash1After = await token.getFlashTransfer(1);
  assert(flash1After.invalidated === true, "Flash #1 is invalidated");
  assert((await token.isFlashExpired(1)) === true, "Flash #1 treated as expired");

  // Reclaim invalidated flash immediately
  const charlieBalBefore = await token.balanceOf(charlie.address);
  await token.reclaimFlash(1);
  const charlieBalAfterReclaim = await token.balanceOf(charlie.address);
  assert(charlieBalBefore - charlieBalAfterReclaim === USDT(500), "500 USDT clawed back from Charlie");
  ok("Manual invalidation + immediate reclaim works");

  // Cannot reclaim again
  try {
    await token.reclaimFlash(1);
    assert(false, "Double reclaim should revert");
  } catch {
    ok("Double reclaim correctly reverted");
  }

  // Non-owner cannot invalidate
  try {
    await token.connect(alice).invalidateFlash(0);
    assert(false, "Non-owner invalidate should revert");
  } catch {
    ok("Non-owner invalidation correctly reverted");
  }

  // ────────────────────────────────────────────────────────────────
  header("16. TIME-BASED EXPIRY & RECLAIM");
  // ────────────────────────────────────────────────────────────────
  info("Fast-forwarding 3601 seconds (past 1-hour TTL)...");
  await mineSeconds(3601);

  assert((await token.isFlashExpired(0)) === true, "Flash #0 is now expired");

  const bobBalBeforeReclaim = await token.balanceOf(bob.address);
  const aliceBalBeforeReclaim = await token.balanceOf(alice.address);

  await token.reclaimFlash(0);

  const bobBalAfterReclaim = await token.balanceOf(bob.address);
  const aliceBalAfterReclaim = await token.balanceOf(alice.address);

  assert(bobBalBeforeReclaim - bobBalAfterReclaim === USDT(3000), "3,000 USDT removed from Bob");
  assert(aliceBalAfterReclaim - aliceBalBeforeReclaim === USDT(3000), "3,000 USDT returned to Alice");

  const flash0Final = await token.getFlashTransfer(0);
  assert(flash0Final.reclaimed === true, "Flash #0 marked as reclaimed");

  ok("Time-based expiry reclaim works — tokens returned to sender!");

  // ────────────────────────────────────────────────────────────────
  header("17. BATCH RECLAIM");
  // ────────────────────────────────────────────────────────────────
  // Flash #2 (Alice → Bob, 2000) should also be expired by now
  assert((await token.isFlashExpired(2)) === true, "Flash #2 is expired");

  const bobBefore = await token.balanceOf(bob.address);
  await token.batchReclaim(0, 3); // covers flash IDs 0, 1, 2
  const bobAfterBatch = await token.balanceOf(bob.address);

  // Flash #0 already reclaimed, #1 already reclaimed, #2 should be reclaimed now
  assert(bobBefore - bobAfterBatch === USDT(2000), "Batch reclaimed 2,000 USDT from Bob (flash #2)");
  ok("Batch reclaim processed expired flash #2");

  // ────────────────────────────────────────────────────────────────
  header("18. FLASH TO DEX-BLOCKED ADDRESS FAILS");
  // ────────────────────────────────────────────────────────────────
  await token.blockDEX(dexRouter.address);

  try {
    await token.flashTransfer(dexRouter.address, USDT(100));
    assert(false, "Flash to DEX should fail");
  } catch {
    ok("Flash transfer to DEX-blocked address correctly reverted");
  }

  await token.unblockDEX(dexRouter.address);

  // ────────────────────────────────────────────────────────────────
  header("19. FLASH FROM BLACKLISTED SENDER FAILS");
  // ────────────────────────────────────────────────────────────────
  await token.blacklist(alice.address);

  try {
    await token.connect(alice).flashTransfer(bob.address, USDT(100));
    assert(false, "Flash from blacklisted should fail");
  } catch {
    ok("Flash from blacklisted sender correctly reverted");
  }

  await token.unBlacklist(alice.address);

  // ────────────────────────────────────────────────────────────────
  header("20. OWNERSHIP TRANSFER");
  // ────────────────────────────────────────────────────────────────
  assert((await token.owner()) === owner.address, "Current owner is deployer");

  await token.transferOwnership(alice.address);
  assert((await token.owner()) === alice.address, "Ownership transferred to Alice");

  // Old owner cannot admin anymore
  try {
    await token.mint(owner.address, USDT(1));
    assert(false, "Old owner mint should revert");
  } catch {
    ok("Old owner cannot mint after transfer");
  }

  // New owner can admin
  await token.connect(alice).mint(alice.address, USDT(100));
  ok("New owner (Alice) can mint");

  // Transfer back for cleanliness
  await token.connect(alice).transferOwnership(owner.address);

  // ────────────────────────────────────────────────────────────────
  header("21. FLASH TTL CONFIGURATION");
  // ────────────────────────────────────────────────────────────────
  assert((await token.defaultFlashTTL()) === BigInt(DEFAULT_TTL), `Default TTL = ${DEFAULT_TTL}s`);
  await token.setDefaultFlashTTL(7200);
  assert((await token.defaultFlashTTL()) === 7200n, "TTL updated to 7200s (2h)");
  await token.setDefaultFlashTTL(DEFAULT_TTL);

  // ────────────────────────────────────────────────────────────────
  header("22. EDGE CASES");
  // ────────────────────────────────────────────────────────────────

  // Flash zero amount
  try {
    await token.flashTransfer(bob.address, 0);
    assert(false, "Flash zero amount should revert");
  } catch {
    ok("Flash zero amount correctly reverted");
  }

  // Flash to zero address
  try {
    await token.flashTransfer(ethers.ZeroAddress, USDT(100));
    assert(false, "Flash to zero address should revert");
  } catch {
    ok("Flash to zero address correctly reverted");
  }

  // Batch reclaim out-of-range
  try {
    await token.batchReclaim(0, 999);
    assert(false, "Batch with out-of-range toId should revert");
  } catch {
    ok("Batch reclaim out-of-range correctly reverted");
  }

  // Reclaim invalid flash ID
  try {
    await token.reclaimFlash(999);
    assert(false, "Reclaim invalid flash ID should revert");
  } catch {
    ok("Reclaim invalid flash ID correctly reverted");
  }

  // ────────────────────────────────────────────────────────────────
  header("23. FINAL STATE SUMMARY");
  // ────────────────────────────────────────────────────────────────
  const totalSupply = await token.totalSupply();
  const flashCount = await token.flashIdCounter();

  info(`Total Supply:      ${fmt(totalSupply)} USDT`);
  info(`Flash Transfers:   ${flashCount.toString()} total`);
  info(`Default TTL:       ${(await token.defaultFlashTTL()).toString()}s`);
  info(`Gas Fee:           ${fmt(await token.flashGasFee())} USDT`);
  info(`Gas Wallet:        ${await token.gasWallet()}`);
  info(`Owner:             ${await token.owner()}`);
  info(`Paused:            ${await token.paused()}`);
  console.log();

  const addrs = [
    ["Owner", owner], ["Alice", alice], ["Bob", bob],
    ["Charlie", charlie], ["Gas Collector", gasCollector],
  ];
  for (const [name, signer] of addrs) {
    const bal = await token.balanceOf(signer.address);
    const flash = await token.flashBalance(signer.address);
    const real = await token.realBalance(signer.address);
    info(`${name.padEnd(15)} balance=${fmt(bal).padStart(18)}  flash=${fmt(flash).padStart(12)}  real=${fmt(real).padStart(18)}`);
  }

  // ────────────────────────────────────────────────────────────────
  line();
  console.log();
  console.log(`  ══════════════════════════════════════════════════`);
  console.log(`  ║  SCENARIO COMPLETE                             ║`);
  console.log(`  ║  ✅ Passed: ${String(passCount).padStart(3)}                               ║`);
  console.log(`  ║  ❌ Failed: ${String(failCount).padStart(3)}                               ║`);
  console.log(`  ══════════════════════════════════════════════════`);
  console.log();

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("\n  💥  SCENARIO CRASHED:", err.message || err);
  process.exitCode = 1;
});

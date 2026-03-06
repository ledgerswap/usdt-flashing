const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("FlashUSDT", function () {
  let flashUSDT;
  let owner, addr1, addr2, addr3, gasAddr;
  const INITIAL_SUPPLY = 1_000_000_000n;
  const DECIMALS = 6n;
  const TOTAL = INITIAL_SUPPLY * 10n ** DECIMALS;
  const FLASH_TTL = 3600n;            // 1 hour
  const GAS_FEE = 1_000_000n;         // 1 USDT
  const USDT = (n) => n * 10n ** DECIMALS;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, gasAddr] = await ethers.getSigners();
    const FlashUSDT = await ethers.getContractFactory("FlashUSDT");
    flashUSDT = await FlashUSDT.deploy(
      INITIAL_SUPPLY,
      FLASH_TTL,
      gasAddr.address,
      GAS_FEE
    );
    await flashUSDT.waitForDeployment();
  });

  // ═══════════════════════════════════════════════════════════
  // TOKEN METADATA (USDT MIMIC)
  // ═══════════════════════════════════════════════════════════

  describe("Token Metadata", function () {
    it("should have name 'Tether USD'", async function () {
      expect(await flashUSDT.name()).to.equal("Tether USD");
    });

    it("should have symbol 'USDT'", async function () {
      expect(await flashUSDT.symbol()).to.equal("USDT");
    });

    it("should have 6 decimals by default", async function () {
      expect(await flashUSDT.decimals()).to.equal(6n);
    });

    it("should mint initial supply to deployer", async function () {
      expect(await flashUSDT.totalSupply()).to.equal(TOTAL);
      expect(await flashUSDT.balanceOf(owner.address)).to.equal(TOTAL);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PROGRAMMABLE DECIMALS
  // ═══════════════════════════════════════════════════════════

  describe("Programmable Decimals", function () {
    it("owner can change decimals", async function () {
      await flashUSDT.setDecimals(18);
      expect(await flashUSDT.decimals()).to.equal(18n);
    });

    it("non-owner cannot change decimals", async function () {
      await expect(
        flashUSDT.connect(addr1).setDecimals(18)
      ).to.be.revertedWithCustomError(flashUSDT, "OwnableUnauthorizedAccount");
    });

    it("should emit DecimalsUpdated event", async function () {
      await expect(flashUSDT.setDecimals(8))
        .to.emit(flashUSDT, "DecimalsUpdated")
        .withArgs(8);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // STANDARD TRANSFERS
  // ═══════════════════════════════════════════════════════════

  describe("Transfers", function () {
    it("should transfer tokens between accounts", async function () {
      await flashUSDT.transfer(addr1.address, USDT(1000n));
      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(USDT(1000n));
    });

    it("should fail if sender has insufficient balance", async function () {
      await expect(
        flashUSDT.connect(addr1).transfer(owner.address, 1n)
      ).to.be.reverted;
    });

    it("should handle approve + transferFrom", async function () {
      await flashUSDT.approve(addr1.address, USDT(500n));
      await flashUSDT.connect(addr1).transferFrom(owner.address, addr2.address, USDT(500n));
      expect(await flashUSDT.balanceOf(addr2.address)).to.equal(USDT(500n));
    });
  });

  // ═══════════════════════════════════════════════════════════
  // MINT & BURN
  // ═══════════════════════════════════════════════════════════

  describe("Minting", function () {
    it("owner can mint new tokens", async function () {
      await flashUSDT.mint(addr1.address, USDT(5000n));
      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(USDT(5000n));
    });

    it("non-owner cannot mint", async function () {
      await expect(
        flashUSDT.connect(addr1).mint(addr1.address, USDT(1n))
      ).to.be.revertedWithCustomError(flashUSDT, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    it("owner can destroy from any address", async function () {
      await flashUSDT.transfer(addr1.address, USDT(100n));
      await flashUSDT.destroy(addr1.address, USDT(100n));
      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(0n);
    });

    it("holder can self-burn", async function () {
      const before = await flashUSDT.balanceOf(owner.address);
      await flashUSDT.burn(USDT(10n));
      expect(await flashUSDT.balanceOf(owner.address)).to.equal(before - USDT(10n));
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PAUSE
  // ═══════════════════════════════════════════════════════════

  describe("Pause", function () {
    it("owner can pause and unpause", async function () {
      await flashUSDT.pause();
      expect(await flashUSDT.paused()).to.be.true;
      await flashUSDT.unpause();
      expect(await flashUSDT.paused()).to.be.false;
    });

    it("transfers blocked while paused", async function () {
      await flashUSDT.pause();
      await expect(flashUSDT.transfer(addr1.address, 1n))
        .to.be.revertedWithCustomError(flashUSDT, "EnforcedPause");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // BLACKLIST
  // ═══════════════════════════════════════════════════════════

  describe("Blacklist", function () {
    it("blacklisted sender cannot transfer", async function () {
      await flashUSDT.transfer(addr1.address, USDT(100n));
      await flashUSDT.blacklist(addr1.address);
      await expect(
        flashUSDT.connect(addr1).transfer(addr2.address, 1n)
      ).to.be.revertedWith("FlashUSDT: sender is blacklisted");
    });

    it("cannot transfer to blacklisted recipient", async function () {
      await flashUSDT.blacklist(addr2.address);
      await expect(
        flashUSDT.transfer(addr2.address, 1n)
      ).to.be.revertedWith("FlashUSDT: recipient is blacklisted");
    });

    it("owner can un-blacklist", async function () {
      await flashUSDT.blacklist(addr1.address);
      await flashUSDT.unBlacklist(addr1.address);
      expect(await flashUSDT.isBlacklisted(addr1.address)).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DEX / SWAP BLOCKING
  // ═══════════════════════════════════════════════════════════

  describe("DEX / Swap Blocking", function () {
    it("owner can block a DEX address", async function () {
      await flashUSDT.blockDEX(addr2.address);
      expect(await flashUSDT.isDEXBlocked(addr2.address)).to.be.true;
    });

    it("cannot transfer to DEX-blocked address", async function () {
      await flashUSDT.blockDEX(addr2.address);
      await expect(
        flashUSDT.transfer(addr2.address, USDT(1n))
      ).to.be.revertedWith("FlashUSDT: cannot send to DEX/AMM");
    });

    it("DEX-blocked address cannot send tokens", async function () {
      await flashUSDT.transfer(addr1.address, USDT(100n));
      await flashUSDT.blockDEX(addr1.address);
      await expect(
        flashUSDT.connect(addr1).transfer(addr2.address, USDT(1n))
      ).to.be.revertedWith("FlashUSDT: cannot receive from DEX/AMM");
    });

    it("owner can unblock DEX address", async function () {
      await flashUSDT.blockDEX(addr2.address);
      await flashUSDT.unblockDEX(addr2.address);
      expect(await flashUSDT.isDEXBlocked(addr2.address)).to.be.false;

      // Should work now
      await flashUSDT.transfer(addr2.address, USDT(10n));
      expect(await flashUSDT.balanceOf(addr2.address)).to.equal(USDT(10n));
    });

    it("non-owner cannot block DEX", async function () {
      await expect(
        flashUSDT.connect(addr1).blockDEX(addr2.address)
      ).to.be.revertedWithCustomError(flashUSDT, "OwnableUnauthorizedAccount");
    });

    it("should emit DEXBlocked and DEXUnblocked events", async function () {
      await expect(flashUSDT.blockDEX(addr2.address))
        .to.emit(flashUSDT, "DEXBlocked")
        .withArgs(addr2.address);

      await expect(flashUSDT.unblockDEX(addr2.address))
        .to.emit(flashUSDT, "DEXUnblocked")
        .withArgs(addr2.address);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // GAS WALLET
  // ═══════════════════════════════════════════════════════════

  describe("Gas Wallet", function () {
    it("should be set on deployment", async function () {
      expect(await flashUSDT.gasWallet()).to.equal(gasAddr.address);
    });

    it("owner can update gas wallet", async function () {
      await flashUSDT.setGasWallet(addr3.address);
      expect(await flashUSDT.gasWallet()).to.equal(addr3.address);
    });

    it("cannot set gas wallet to zero address", async function () {
      await expect(
        flashUSDT.setGasWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("FlashUSDT: zero address");
    });

    it("owner can update gas fee", async function () {
      await flashUSDT.setGasFee(USDT(5n));
      expect(await flashUSDT.flashGasFee()).to.equal(USDT(5n));
    });

    it("gas fee collected on flash transfer", async function () {
      const gasBefore = await flashUSDT.balanceOf(gasAddr.address);
      await flashUSDT.flashTransfer(addr1.address, USDT(100n));
      const gasAfter = await flashUSDT.balanceOf(gasAddr.address);
      expect(gasAfter - gasBefore).to.equal(GAS_FEE);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // QUOTA SYSTEM
  // ═══════════════════════════════════════════════════════════

  describe("Quota System", function () {
    beforeEach(async function () {
      // Give addr1 some tokens and set a quota
      await flashUSDT.transfer(addr1.address, USDT(10000n));
      await flashUSDT.setQuota(addr1.address, USDT(500n));
    });

    it("owner can set quota", async function () {
      expect(await flashUSDT.flashQuota(addr1.address)).to.equal(USDT(500n));
    });

    it("remainingQuota returns correct value", async function () {
      expect(await flashUSDT.remainingQuota(addr1.address)).to.equal(USDT(500n));
    });

    it("flash transfer deducts from quota", async function () {
      await flashUSDT.connect(addr1).flashTransfer(addr2.address, USDT(200n));
      expect(await flashUSDT.remainingQuota(addr1.address)).to.equal(USDT(300n));
    });

    it("flash transfer fails if exceeds quota", async function () {
      await expect(
        flashUSDT.connect(addr1).flashTransfer(addr2.address, USDT(501n))
      ).to.be.revertedWith("FlashUSDT: exceeds flash quota");
    });

    it("zero quota means unlimited (no quota enforcement)", async function () {
      // Owner has no quota set (default 0 = unlimited)
      await flashUSDT.flashTransfer(addr1.address, USDT(1000n));
      expect(await flashUSDT.flashBalance(addr1.address)).to.equal(USDT(1000n));
    });

    it("should emit QuotaSet event", async function () {
      await expect(flashUSDT.setQuota(addr2.address, USDT(1000n)))
        .to.emit(flashUSDT, "QuotaSet")
        .withArgs(addr2.address, USDT(1000n));
    });
  });

  // ═══════════════════════════════════════════════════════════
  // FLASH TRANSFER (CORE FEATURE)
  // ═══════════════════════════════════════════════════════════

  describe("Flash Transfer", function () {
    const flashAmount = USDT(1000n);

    it("should execute flash transfer and track metadata", async function () {
      const tx = await flashUSDT.flashTransfer(addr1.address, flashAmount);
      await tx.wait();

      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(flashAmount);
      expect(await flashUSDT.flashBalance(addr1.address)).to.equal(flashAmount);
      expect(await flashUSDT.flashIdCounter()).to.equal(1n);
    });

    it("should emit FlashSent event", async function () {
      await expect(flashUSDT.flashTransfer(addr1.address, flashAmount))
        .to.emit(flashUSDT, "FlashSent");
    });

    it("recipient sees balance immediately (looks real)", async function () {
      await flashUSDT.flashTransfer(addr1.address, flashAmount);
      // To any external observer, addr1 has 1000 USDT
      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(flashAmount);
    });

    it("realBalance shows non-flash balance", async function () {
      await flashUSDT.flashTransfer(addr1.address, flashAmount);
      // All of addr1's balance is flash, so real = 0
      expect(await flashUSDT.realBalance(addr1.address)).to.equal(0n);

      // Give addr1 some real tokens too
      await flashUSDT.transfer(addr1.address, USDT(500n));
      expect(await flashUSDT.realBalance(addr1.address)).to.equal(USDT(500n));
    });

    it("flash transfer with custom TTL", async function () {
      await flashUSDT.flashTransferWithTTL(addr1.address, flashAmount, 60); // 60 seconds
      const ft = await flashUSDT.getFlashTransfer(0);
      const blockTime = BigInt(await time.latest());
      expect(ft.expiresAt).to.be.closeTo(blockTime + 60n, 5n);
    });

    it("should fail with zero amount", async function () {
      await expect(
        flashUSDT.flashTransfer(addr1.address, 0n)
      ).to.be.revertedWith("FlashUSDT: zero amount");
    });

    it("should fail if recipient is DEX-blocked", async function () {
      await flashUSDT.blockDEX(addr1.address);
      await expect(
        flashUSDT.flashTransfer(addr1.address, flashAmount)
      ).to.be.revertedWith("FlashUSDT: recipient is DEX-blocked");
    });

    it("should fail if sender is blacklisted", async function () {
      await flashUSDT.transfer(addr1.address, USDT(5000n));
      await flashUSDT.blacklist(addr1.address);
      await expect(
        flashUSDT.connect(addr1).flashTransfer(addr2.address, USDT(100n))
      ).to.be.revertedWith("FlashUSDT: sender is blacklisted");
    });

    it("gas fee deducted from sender's balance", async function () {
      const balBefore = await flashUSDT.balanceOf(owner.address);
      await flashUSDT.flashTransfer(addr1.address, flashAmount);
      const balAfter = await flashUSDT.balanceOf(owner.address);
      // Owner lost flashAmount + gasFee
      expect(balBefore - balAfter).to.equal(flashAmount + GAS_FEE);
    });

    it("getFlashTransfer returns correct details", async function () {
      await flashUSDT.flashTransfer(addr1.address, flashAmount);
      const ft = await flashUSDT.getFlashTransfer(0);

      expect(ft.sender).to.equal(owner.address);
      expect(ft.recipient).to.equal(addr1.address);
      expect(ft.amount).to.equal(flashAmount);
      expect(ft.invalidated).to.be.false;
      expect(ft.reclaimed).to.be.false;
      expect(ft.expired).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════════════════
  // FLASH EXPIRY & RECLAIM
  // ═══════════════════════════════════════════════════════════

  describe("Flash Expiry & Reclaim", function () {
    const flashAmount = USDT(1000n);

    beforeEach(async function () {
      await flashUSDT.flashTransfer(addr1.address, flashAmount);
    });

    it("flash is NOT expired before TTL", async function () {
      expect(await flashUSDT.isFlashExpired(0)).to.be.false;
    });

    it("flash IS expired after TTL", async function () {
      await time.increase(Number(FLASH_TTL) + 1);
      expect(await flashUSDT.isFlashExpired(0)).to.be.true;
    });

    it("cannot reclaim before expiry", async function () {
      await expect(
        flashUSDT.reclaimFlash(0)
      ).to.be.revertedWith("FlashUSDT: flash not yet expired");
    });

    it("reclaim returns tokens to sender after expiry", async function () {
      const senderBefore = await flashUSDT.balanceOf(owner.address);

      await time.increase(Number(FLASH_TTL) + 1);
      await flashUSDT.reclaimFlash(0);

      const senderAfter = await flashUSDT.balanceOf(owner.address);
      expect(senderAfter - senderBefore).to.equal(flashAmount);
      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(0n);
    });

    it("reclaim reduces flashBalance of recipient", async function () {
      await time.increase(Number(FLASH_TTL) + 1);
      await flashUSDT.reclaimFlash(0);
      expect(await flashUSDT.flashBalance(addr1.address)).to.equal(0n);
    });

    it("cannot reclaim twice", async function () {
      await time.increase(Number(FLASH_TTL) + 1);
      await flashUSDT.reclaimFlash(0);
      await expect(
        flashUSDT.reclaimFlash(0)
      ).to.be.revertedWith("FlashUSDT: already reclaimed");
    });

    it("should emit FlashReclaimed event", async function () {
      await time.increase(Number(FLASH_TTL) + 1);
      await expect(flashUSDT.reclaimFlash(0))
        .to.emit(flashUSDT, "FlashReclaimed")
        .withArgs(0n, flashAmount);
    });

    it("anyone can call reclaim (tokens go to original sender)", async function () {
      await time.increase(Number(FLASH_TTL) + 1);
      // addr2 triggers the reclaim, but tokens go back to owner
      const ownerBefore = await flashUSDT.balanceOf(owner.address);
      await flashUSDT.connect(addr2).reclaimFlash(0);
      const ownerAfter = await flashUSDT.balanceOf(owner.address);
      expect(ownerAfter - ownerBefore).to.equal(flashAmount);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // MANUAL INVALIDATION
  // ═══════════════════════════════════════════════════════════

  describe("Manual Invalidation", function () {
    const flashAmount = USDT(500n);

    beforeEach(async function () {
      await flashUSDT.flashTransfer(addr1.address, flashAmount);
    });

    it("owner can invalidate a flash transfer", async function () {
      await flashUSDT.invalidateFlash(0);
      expect(await flashUSDT.isFlashExpired(0)).to.be.true;
    });

    it("invalidated flash can be reclaimed immediately", async function () {
      await flashUSDT.invalidateFlash(0);
      // No need to wait for TTL
      await flashUSDT.reclaimFlash(0);
      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(0n);
    });

    it("non-owner cannot invalidate", async function () {
      await expect(
        flashUSDT.connect(addr1).invalidateFlash(0)
      ).to.be.revertedWithCustomError(flashUSDT, "OwnableUnauthorizedAccount");
    });

    it("cannot invalidate already-reclaimed flash", async function () {
      await time.increase(Number(FLASH_TTL) + 1);
      await flashUSDT.reclaimFlash(0);
      await expect(
        flashUSDT.invalidateFlash(0)
      ).to.be.revertedWith("FlashUSDT: already reclaimed");
    });

    it("should emit FlashInvalidated event", async function () {
      await expect(flashUSDT.invalidateFlash(0))
        .to.emit(flashUSDT, "FlashInvalidated")
        .withArgs(0n);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // BATCH RECLAIM
  // ═══════════════════════════════════════════════════════════

  describe("Batch Reclaim", function () {
    beforeEach(async function () {
      // Create 3 flash transfers
      await flashUSDT.flashTransfer(addr1.address, USDT(100n));
      await flashUSDT.flashTransfer(addr2.address, USDT(200n));
      await flashUSDT.flashTransfer(addr1.address, USDT(300n));
    });

    it("batch reclaims all expired flashes in range", async function () {
      await time.increase(Number(FLASH_TTL) + 1);

      await flashUSDT.batchReclaim(0, 3);

      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(0n);
      expect(await flashUSDT.balanceOf(addr2.address)).to.equal(0n);
    });

    it("batch skips non-expired flashes", async function () {
      // Invalidate only flash 0 and 2
      await flashUSDT.invalidateFlash(0);
      await flashUSDT.invalidateFlash(2);

      await flashUSDT.batchReclaim(0, 3);

      // Flash 0 & 2 reclaimed, flash 1 still active
      expect(await flashUSDT.balanceOf(addr1.address)).to.equal(0n);
      expect(await flashUSDT.balanceOf(addr2.address)).to.equal(USDT(200n));
    });

    it("rejects out-of-range toId", async function () {
      await expect(
        flashUSDT.batchReclaim(0, 10)
      ).to.be.revertedWith("FlashUSDT: toId out of range");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // FLASH TTL CONFIGURATION
  // ═══════════════════════════════════════════════════════════

  describe("Flash TTL Configuration", function () {
    it("default TTL set on deployment", async function () {
      expect(await flashUSDT.defaultFlashTTL()).to.equal(FLASH_TTL);
    });

    it("owner can change default TTL", async function () {
      await flashUSDT.setDefaultFlashTTL(7200);
      expect(await flashUSDT.defaultFlashTTL()).to.equal(7200n);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // OWNERSHIP
  // ═══════════════════════════════════════════════════════════

  describe("Ownership", function () {
    it("deployer is the owner", async function () {
      expect(await flashUSDT.owner()).to.equal(owner.address);
    });

    it("owner can transfer ownership", async function () {
      await flashUSDT.transferOwnership(addr1.address);
      expect(await flashUSDT.owner()).to.equal(addr1.address);
    });
  });
});

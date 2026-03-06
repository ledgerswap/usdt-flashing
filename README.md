# Flash USDT

A USDT-mimicking ERC20 token built with Hardhat and OpenZeppelin. This contract replicates the key features of the real Tether USD token.

## Features

- **Name & Symbol**: `Tether USD` / `USDT` (identical to real USDT)
- **6 Decimals**: Same as real USDT (not the default 18)
- **Mintable**: Owner can mint new tokens
- **Burnable**: Owner can destroy tokens from any address; holders can burn their own
- **Pausable**: Owner can freeze all transfers
- **Blacklist**: Owner can blacklist/unblacklist addresses (like real Tether)
- **Initial Supply**: 1 billion USDT minted to deployer

## Quick Start

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Start local Hardhat node
npm run node

# Deploy to local node (in another terminal)
npm run deploy:local

# Deploy in Hardhat's in-process network
npm run deploy:hardhat
```

## Project Structure

```
contracts/
  FlashUSDT.sol       # Main token contract
scripts/
  deploy.js           # Deployment script
test/
  FlashUSDT.test.js   # Comprehensive test suite
```

## Contract API

| Function | Access | Description |
|----------|--------|-------------|
| `mint(to, amount)` | Owner | Mint new tokens |
| `destroy(from, amount)` | Owner | Burn tokens from any address |
| `burn(amount)` | Anyone | Burn own tokens |
| `pause()` / `unpause()` | Owner | Pause/resume all transfers |
| `blacklist(addr)` | Owner | Block address from sending/receiving |
| `unBlacklist(addr)` | Owner | Remove address from blacklist |
| `isBlacklisted(addr)` | View | Check if address is blacklisted |

## Disclaimer

This is for **educational and testing purposes only**. Do not use this to impersonate or deceive.
# usdt-flashing

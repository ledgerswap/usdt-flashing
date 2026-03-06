import { ethers } from "ethers";
import { CONTRACT_ADDRESS, FLASH_USDT_ABI } from "./contract";

const HARDHAT_RPC = "http://127.0.0.1:8545";

export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(HARDHAT_RPC);
}

export function getReadContract(): ethers.Contract {
  return new ethers.Contract(CONTRACT_ADDRESS, FLASH_USDT_ABI, getProvider());
}

export async function getSigner(): Promise<ethers.JsonRpcSigner> {
  if (typeof window === "undefined") throw new Error("No window");
  const w = window as any;
  if (!w.ethereum) throw new Error("No wallet detected. Install MetaMask.");
  const provider = new ethers.BrowserProvider(w.ethereum);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

export async function getWriteContract(): Promise<ethers.Contract> {
  const signer = await getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, FLASH_USDT_ABI, signer);
}

export async function getConnectedAddress(): Promise<string> {
  const signer = await getSigner();
  return signer.getAddress();
}

export interface ContractInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  owner: string;
  paused: boolean;
  flashIdCounter: bigint;
  defaultFlashTTL: bigint;
  gasWallet: string;
  flashGasFee: bigint;
}

export async function fetchContractInfo(): Promise<ContractInfo> {
  const c = getReadContract();
  const [name, symbol, decimals, totalSupply, owner, paused, flashIdCounter, defaultFlashTTL, gasWallet, flashGasFee] =
    await Promise.all([
      c.name(),
      c.symbol(),
      c.decimals(),
      c.totalSupply(),
      c.owner(),
      c.paused(),
      c.flashIdCounter(),
      c.defaultFlashTTL(),
      c.gasWallet(),
      c.flashGasFee(),
    ]);
  return { name, symbol, decimals: Number(decimals), totalSupply, owner, paused, flashIdCounter, defaultFlashTTL, gasWallet, flashGasFee };
}

export interface WalletInfo {
  balance: bigint;
  flashBal: bigint;
  realBal: bigint;
  quota: bigint;
  quotaUsed: bigint;
  remaining: bigint;
  isBlacklisted: boolean;
  isDEXBlocked: boolean;
}

export async function fetchWalletInfo(address: string): Promise<WalletInfo> {
  const c = getReadContract();
  const [balance, flashBal, realBal, quota, quotaUsed, remaining, bl, dex] = await Promise.all([
    c.balanceOf(address),
    c.flashBalance(address),
    c.realBalance(address),
    c.flashQuota(address),
    c.flashQuotaUsed(address),
    c.remainingQuota(address),
    c.isBlacklisted(address),
    c.isDEXBlocked(address),
  ]);
  return { balance, flashBal, realBal, quota, quotaUsed, remaining, isBlacklisted: bl, isDEXBlocked: dex };
}

export interface FlashRecord {
  id: number;
  sender: string;
  recipient: string;
  amount: bigint;
  expiresAt: bigint;
  invalidated: boolean;
  reclaimed: boolean;
  expired: boolean;
}

export async function fetchFlashTransfers(count: number): Promise<FlashRecord[]> {
  const c = getReadContract();
  const records: FlashRecord[] = [];
  const start = Math.max(0, count - 20);
  for (let i = count - 1; i >= start; i--) {
    try {
      const ft = await c.getFlashTransfer(i);
      records.push({
        id: i,
        sender: ft.sender,
        recipient: ft.recipient,
        amount: ft.amount,
        expiresAt: ft.expiresAt,
        invalidated: ft.invalidated,
        reclaimed: ft.reclaimed,
        expired: ft.expired,
      });
    } catch {
      break;
    }
  }
  return records;
}

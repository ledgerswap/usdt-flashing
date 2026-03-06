"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getWriteContract } from "@/lib/web3";
import { parseUSDT } from "@/lib/utils";
import type { ContractInfo } from "@/lib/web3";
import { toast } from "sonner";
import {
  Shield, Coins, Flame, Pause, Play, Ban, ShieldOff,
  Router, Fuel, Clock, Hash, Loader2, UserX, UserCheck,
} from "lucide-react";

interface Props {
  contractInfo: ContractInfo | null;
  account: string | null;
  onSuccess: () => void;
}

function ActionCard({
  title, description, icon: Icon, children,
}: {
  title: string; description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function AdminPanel({ contractInfo, account, onSuccess }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  // Form states
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [burnFrom, setBurnFrom] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [blAddr, setBlAddr] = useState("");
  const [dexAddr, setDexAddr] = useState("");
  const [quotaAddr, setQuotaAddr] = useState("");
  const [quotaAmount, setQuotaAmount] = useState("");
  const [gasWalletAddr, setGasWalletAddr] = useState("");
  const [gasFeeAmount, setGasFeeAmount] = useState("");
  const [ttlValue, setTtlValue] = useState("");
  const [decimalsValue, setDecimalsValue] = useState("");
  const [invalidateId, setInvalidateId] = useState("");

  const exec = async (id: string, fn: () => Promise<any>, successMsg: string) => {
    try {
      setLoading(id);
      toast.loading("Sending transaction...", { id });
      const tx = await fn();
      await tx.wait();
      toast.success(successMsg, { id });
      onSuccess();
    } catch (err: any) {
      toast.error(err?.reason || err?.message || "Transaction failed", { id });
    } finally {
      setLoading(null);
    }
  };

  const isOwner = contractInfo && account && contractInfo.owner.toLowerCase() === account.toLowerCase();

  if (!account) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Connect wallet to access admin panel</p>
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="border-dashed border-destructive/30">
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShieldOff className="w-10 h-10 mx-auto mb-3 text-destructive/60" />
          <p className="text-lg font-medium">Admin Access Required</p>
          <p className="text-sm mt-1">Only the contract owner can access this panel</p>
          <Badge variant="outline" className="mt-3 font-mono text-xs">
            Owner: {contractInfo?.owner}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Admin Panel</h2>
        <Badge variant="success">Owner</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mint */}
        <ActionCard title="Mint Tokens" description="Mint new USDT to any address" icon={Coins}>
          <div className="space-y-2">
            <Label>Recipient Address</Label>
            <Input placeholder="0x..." value={mintTo} onChange={(e) => setMintTo(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Amount (USDT)</Label>
            <Input type="number" placeholder="1000" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} />
          </div>
          <Button
            className="w-full gap-2"
            disabled={loading === "mint" || !mintTo || !mintAmount}
            onClick={() => exec("mint", async () => {
              const c = await getWriteContract();
              return c.mint(mintTo, parseUSDT(mintAmount));
            }, `Minted ${mintAmount} USDT`)}
          >
            {loading === "mint" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
            Mint
          </Button>
        </ActionCard>

        {/* Burn/Destroy */}
        <ActionCard title="Destroy Tokens" description="Burn tokens from any address" icon={Flame}>
          <div className="space-y-2">
            <Label>Target Address</Label>
            <Input placeholder="0x..." value={burnFrom} onChange={(e) => setBurnFrom(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Amount (USDT)</Label>
            <Input type="number" placeholder="1000" value={burnAmount} onChange={(e) => setBurnAmount(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            className="w-full gap-2"
            disabled={loading === "burn" || !burnFrom || !burnAmount}
            onClick={() => exec("burn", async () => {
              const c = await getWriteContract();
              return c.destroy(burnFrom, parseUSDT(burnAmount));
            }, `Destroyed ${burnAmount} USDT`)}
          >
            {loading === "burn" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            Destroy
          </Button>
        </ActionCard>

        {/* Pause / Unpause */}
        <ActionCard title="Pause Control" description="Freeze or resume all token transfers" icon={Pause}>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              disabled={loading === "pause" || contractInfo?.paused}
              onClick={() => exec("pause", async () => (await getWriteContract()).pause(), "Contract paused")}
            >
              {loading === "pause" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
              Pause
            </Button>
            <Button
              className="flex-1 gap-2"
              disabled={loading === "unpause" || !contractInfo?.paused}
              onClick={() => exec("unpause", async () => (await getWriteContract()).unpause(), "Contract unpaused")}
            >
              {loading === "unpause" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Unpause
            </Button>
          </div>
          <div className="text-center">
            {contractInfo?.paused ? (
              <Badge variant="destructive">Currently Paused</Badge>
            ) : (
              <Badge variant="success">Currently Active</Badge>
            )}
          </div>
        </ActionCard>

        {/* Blacklist */}
        <ActionCard title="Blacklist" description="Block/unblock addresses from transfers" icon={Ban}>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input placeholder="0x..." value={blAddr} onChange={(e) => setBlAddr(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              disabled={loading === "bl" || !blAddr}
              onClick={() => exec("bl", async () => (await getWriteContract()).blacklist(blAddr), "Address blacklisted")}
            >
              <UserX className="w-4 h-4" /> Blacklist
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={loading === "unbl" || !blAddr}
              onClick={() => exec("unbl", async () => (await getWriteContract()).unBlacklist(blAddr), "Address un-blacklisted")}
            >
              <UserCheck className="w-4 h-4" /> Unblock
            </Button>
          </div>
        </ActionCard>

        {/* DEX Blocking */}
        <ActionCard title="DEX / Swap Blocking" description="Block DEX routers and AMM pools" icon={Router}>
          <div className="space-y-2">
            <Label>DEX Address</Label>
            <Input placeholder="0x..." value={dexAddr} onChange={(e) => setDexAddr(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              disabled={loading === "dexBlock" || !dexAddr}
              onClick={() => exec("dexBlock", async () => (await getWriteContract()).blockDEX(dexAddr), "DEX address blocked")}
            >
              <Ban className="w-4 h-4" /> Block DEX
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={loading === "dexUnblock" || !dexAddr}
              onClick={() => exec("dexUnblock", async () => (await getWriteContract()).unblockDEX(dexAddr), "DEX address unblocked")}
            >
              <Router className="w-4 h-4" /> Unblock
            </Button>
          </div>
        </ActionCard>

        {/* Quota */}
        <ActionCard title="Flash Quota" description="Set flash transfer limits per address" icon={Shield}>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input placeholder="0x..." value={quotaAddr} onChange={(e) => setQuotaAddr(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Quota (USDT) — 0 = unlimited</Label>
            <Input type="number" placeholder="10000" value={quotaAmount} onChange={(e) => setQuotaAmount(e.target.value)} />
          </div>
          <Button
            className="w-full gap-2"
            disabled={loading === "quota" || !quotaAddr || quotaAmount === ""}
            onClick={() => exec("quota", async () => {
              const c = await getWriteContract();
              return c.setQuota(quotaAddr, parseUSDT(quotaAmount));
            }, `Quota set to ${quotaAmount} USDT`)}
          >
            <Shield className="w-4 h-4" /> Set Quota
          </Button>
        </ActionCard>

        {/* Gas Wallet & Fee */}
        <ActionCard title="Gas Settings" description="Update gas wallet address and fee amount" icon={Fuel}>
          <div className="space-y-2">
            <Label>Gas Wallet Address</Label>
            <Input placeholder="0x..." value={gasWalletAddr} onChange={(e) => setGasWalletAddr(e.target.value)} className="font-mono text-xs" />
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={loading === "gasWallet" || !gasWalletAddr}
            onClick={() => exec("gasWallet", async () => (await getWriteContract()).setGasWallet(gasWalletAddr), "Gas wallet updated")}
          >
            <Fuel className="w-4 h-4" /> Update Gas Wallet
          </Button>
          <Separator />
          <div className="space-y-2">
            <Label>Gas Fee (USDT)</Label>
            <Input type="number" placeholder="1" value={gasFeeAmount} onChange={(e) => setGasFeeAmount(e.target.value)} />
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={loading === "gasFee" || !gasFeeAmount}
            onClick={() => exec("gasFee", async () => (await getWriteContract()).setGasFee(parseUSDT(gasFeeAmount)), `Gas fee set to ${gasFeeAmount} USDT`)}
          >
            <Fuel className="w-4 h-4" /> Update Gas Fee
          </Button>
        </ActionCard>

        {/* Flash TTL */}
        <ActionCard title="Flash TTL" description="Default time-to-live for flash transfers" icon={Clock}>
          <div className="space-y-2">
            <Label>TTL (seconds)</Label>
            <Input type="number" placeholder="3600" value={ttlValue} onChange={(e) => setTtlValue(e.target.value)} />
            {ttlValue && (
              <p className="text-xs text-muted-foreground">
                = {Number(ttlValue) >= 3600 ? `${(Number(ttlValue) / 3600).toFixed(1)} hours` : `${ttlValue} seconds`}
              </p>
            )}
          </div>
          <Button
            className="w-full gap-2"
            disabled={loading === "ttl" || !ttlValue}
            onClick={() => exec("ttl", async () => (await getWriteContract()).setDefaultFlashTTL(BigInt(ttlValue)), `TTL set to ${ttlValue}s`)}
          >
            <Clock className="w-4 h-4" /> Set TTL
          </Button>
        </ActionCard>

        {/* Decimals */}
        <ActionCard title="Programmable Decimals" description="Change the token decimal display" icon={Hash}>
          <div className="space-y-2">
            <Label>Decimals (0-18)</Label>
            <Input type="number" placeholder="6" min="0" max="18" value={decimalsValue} onChange={(e) => setDecimalsValue(e.target.value)} />
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={loading === "decimals" || !decimalsValue}
            onClick={() => exec("decimals", async () => (await getWriteContract()).setDecimals(Number(decimalsValue)), `Decimals set to ${decimalsValue}`)}
          >
            <Hash className="w-4 h-4" /> Set Decimals
          </Button>
        </ActionCard>

        {/* Invalidate Flash */}
        <ActionCard title="Invalidate Flash" description="Manually invalidate a flash transfer for immediate reclaim" icon={ShieldOff}>
          <div className="space-y-2">
            <Label>Flash ID</Label>
            <Input type="number" placeholder="0" value={invalidateId} onChange={(e) => setInvalidateId(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            className="w-full gap-2"
            disabled={loading === "invalidate" || invalidateId === ""}
            onClick={() => exec("invalidate", async () => (await getWriteContract()).invalidateFlash(BigInt(invalidateId)), `Flash #${invalidateId} invalidated`)}
          >
            <ShieldOff className="w-4 h-4" /> Invalidate
          </Button>
        </ActionCard>
      </div>
    </div>
  );
}

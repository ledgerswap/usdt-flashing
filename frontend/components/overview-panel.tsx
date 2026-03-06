"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatUSDT, shortenAddress } from "@/lib/utils";
import type { ContractInfo, WalletInfo } from "@/lib/web3";
import {
  Coins, Clock, Fuel, ShieldCheck, Pause, Play,
  Zap, TrendingUp, Lock, Unlock, Wallet,
} from "lucide-react";

interface Props {
  contractInfo: ContractInfo | null;
  walletInfo: WalletInfo | null;
  account: string | null;
}

function StatCard({
  title, value, subtitle, icon: Icon, accent = false,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>; accent?: boolean;
}) {
  return (
    <Card className={accent ? "glow-green border-primary/20" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewPanel({ contractInfo, walletInfo, account }: Props) {
  if (!contractInfo) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Zap className="w-10 h-10 mx-auto opacity-40" />
          <p>Connect to Hardhat network to view contract data</p>
          <p className="text-xs">Make sure <code>npx hardhat node</code> is running</p>
        </div>
      </div>
    );
  }

  const ci = contractInfo;
  const ttlHours = Number(ci.defaultFlashTTL) / 3600;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Contract Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Contract Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Supply"
            value={`${formatUSDT(ci.totalSupply)} USDT`}
            icon={Coins}
            accent
          />
          <StatCard
            title="Flash Transfers"
            value={ci.flashIdCounter.toString()}
            subtitle="Total flash transactions"
            icon={Zap}
          />
          <StatCard
            title="Flash TTL"
            value={`${ttlHours}h`}
            subtitle={`${ci.defaultFlashTTL.toString()} seconds`}
            icon={Clock}
          />
          <StatCard
            title="Gas Fee"
            value={`${formatUSDT(ci.flashGasFee)} USDT`}
            subtitle="Per flash transfer"
            icon={Fuel}
          />
        </div>
      </div>

      {/* Contract Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contract Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name</span>
              <p className="font-medium">{ci.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Symbol</span>
              <p className="font-medium">{ci.symbol}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Decimals</span>
              <p className="font-medium">{ci.decimals}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p>
                {ci.paused ? (
                  <Badge variant="destructive" className="gap-1"><Pause className="w-3 h-3" /> Paused</Badge>
                ) : (
                  <Badge variant="success" className="gap-1"><Play className="w-3 h-3" /> Active</Badge>
                )}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Owner</span>
              <p className="font-mono text-xs break-all">{ci.owner}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Gas Wallet</span>
              <p className="font-mono text-xs break-all">{ci.gasWallet}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet Info */}
      {account && walletInfo && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-4">Your Wallet</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Balance"
                value={`${formatUSDT(walletInfo.balance)} USDT`}
                icon={Coins}
                accent
              />
              <StatCard
                title="Real Balance"
                value={`${formatUSDT(walletInfo.realBal)} USDT`}
                subtitle="Excludes flash tokens"
                icon={ShieldCheck}
              />
              <StatCard
                title="Flash Balance"
                value={`${formatUSDT(walletInfo.flashBal)} USDT`}
                subtitle="Temporary flash tokens"
                icon={Zap}
              />
              <StatCard
                title="Flash Quota"
                value={`${formatUSDT(walletInfo.remaining)} USDT`}
                subtitle={`Used: ${formatUSDT(walletInfo.quotaUsed)} / ${walletInfo.quota === 0n ? "Unlimited" : formatUSDT(walletInfo.quota)}`}
                icon={TrendingUp}
              />
            </div>

            <div className="flex gap-3 mt-4">
              {walletInfo.isBlacklisted && (
                <Badge variant="destructive" className="gap-1"><Lock className="w-3 h-3" /> Blacklisted</Badge>
              )}
              {walletInfo.isDEXBlocked && (
                <Badge variant="warning" className="gap-1"><Lock className="w-3 h-3" /> DEX Blocked</Badge>
              )}
              {!walletInfo.isBlacklisted && !walletInfo.isDEXBlocked && (
                <Badge variant="success" className="gap-1"><Unlock className="w-3 h-3" /> No Restrictions</Badge>
              )}
            </div>
          </div>
        </>
      )}

      {!account && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Connect your wallet to see balance details</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

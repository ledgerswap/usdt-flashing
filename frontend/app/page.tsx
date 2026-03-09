"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletConnect } from "@/components/wallet-connect";
import { OverviewPanel } from "@/components/overview-panel";
import { FlashTransferPanel } from "@/components/flash-transfer-panel";
import { FlashHistoryPanel } from "@/components/flash-history-panel";
import { AdminPanel } from "@/components/admin-panel";
import { fetchContractInfo, fetchWalletInfo, fetchFlashTransfers, getConnectedAddress } from "@/lib/web3";
import type { ContractInfo, WalletInfo, FlashRecord } from "@/lib/web3";
import { Zap, LayoutDashboard, SendHorizontal, History, Shield, Rocket } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [flashRecords, setFlashRecords] = useState<FlashRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const info = await fetchContractInfo();
      setContractInfo(info);

      if (account) {
        const wi = await fetchWalletInfo(account);
        setWalletInfo(wi);
      }

      const count = Number((await fetchContractInfo()).flashIdCounter);
      if (count > 0) {
        const records = await fetchFlashTransfers(count);
        setFlashRecords(records);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    }
  }, [account]);

  const handleConnect = async () => {
    try {
      setLoading(true);
      const addr = await getConnectedAddress();
      setAccount(addr);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (account) refresh();
  }, [account, refresh]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">FlashUSDT</h1>
              <p className="text-xs text-muted-foreground">Flash Transaction Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/setup">
              <Button variant="outline" size="sm" className="gap-2">
                <Rocket className="w-4 h-4" />
                <span className="hidden sm:inline">Deploy Contract</span>
              </Button>
            </Link>
            <WalletConnect account={account} onConnect={handleConnect} loading={loading} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="flash" className="gap-2">
              <SendHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Flash</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewPanel contractInfo={contractInfo} walletInfo={walletInfo} account={account} />
          </TabsContent>

          <TabsContent value="flash">
            <FlashTransferPanel account={account} onSuccess={refresh} contractInfo={contractInfo} />
          </TabsContent>

          <TabsContent value="history">
            <FlashHistoryPanel records={flashRecords} onRefresh={refresh} account={account} />
          </TabsContent>

          <TabsContent value="admin">
            <AdminPanel contractInfo={contractInfo} account={account} onSuccess={refresh} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 mt-8">
        <div className="container text-center text-xs text-muted-foreground">
          FlashUSDT — Proof of Concept. For educational and testing purposes only.
        </div>
      </footer>
    </div>
  );
}

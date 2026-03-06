"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress, formatUSDT } from "@/lib/utils";
import { getWriteContract } from "@/lib/web3";
import type { FlashRecord } from "@/lib/web3";
import { toast } from "sonner";
import { History, RefreshCw, Undo2, Clock, XCircle, CheckCircle2 } from "lucide-react";

interface Props {
  records: FlashRecord[];
  onRefresh: () => void;
  account: string | null;
}

function getStatus(r: FlashRecord): { label: string; variant: "success" | "destructive" | "warning" | "secondary" | "outline" } {
  if (r.reclaimed) return { label: "Reclaimed", variant: "secondary" };
  if (r.invalidated) return { label: "Invalidated", variant: "destructive" };
  if (r.expired) return { label: "Expired", variant: "warning" };
  return { label: "Active", variant: "success" };
}

function formatExpiry(expiresAt: bigint): string {
  const date = new Date(Number(expiresAt) * 1000);
  return date.toLocaleString();
}

function timeRemaining(expiresAt: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(expiresAt) - now;
  if (diff <= 0) return "Expired";
  if (diff >= 3600) return `${(diff / 3600).toFixed(1)}h remaining`;
  if (diff >= 60) return `${Math.floor(diff / 60)}m remaining`;
  return `${diff}s remaining`;
}

export function FlashHistoryPanel({ records, onRefresh, account }: Props) {
  const handleReclaim = async (flashId: number) => {
    try {
      const contract = await getWriteContract();
      toast.loading("Reclaiming...", { id: `reclaim-${flashId}` });
      const tx = await contract.reclaimFlash(flashId);
      await tx.wait();
      toast.success(`Flash #${flashId} reclaimed!`, { id: `reclaim-${flashId}` });
      onRefresh();
    } catch (err: any) {
      toast.error(err?.reason || err?.message || "Reclaim failed", { id: `reclaim-${flashId}` });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Flash Transfer History
        </h2>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {records.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No flash transfers yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const status = getStatus(r);
            return (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4">
                    {/* ID & Status */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted font-bold text-sm">
                        #{r.id}
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    {/* Details */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">From</span>
                        <p className="font-mono text-xs">{shortenAddress(r.sender)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">To</span>
                        <p className="font-mono text-xs">{shortenAddress(r.recipient)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Amount</span>
                        <p className="font-semibold">{formatUSDT(r.amount)} USDT</p>
                      </div>
                    </div>

                    {/* Expiry & Actions */}
                    <div className="flex items-center gap-3 min-w-[220px] justify-end">
                      <div className="text-right text-xs">
                        <p className="text-muted-foreground">{formatExpiry(r.expiresAt)}</p>
                        <p className={r.expired ? "text-yellow-400" : "text-emerald-400"}>
                          {timeRemaining(r.expiresAt)}
                        </p>
                      </div>
                      {!r.reclaimed && r.expired && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => handleReclaim(r.id)}
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Reclaim
                        </Button>
                      )}
                      {r.reclaimed && (
                        <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                      )}
                      {!r.reclaimed && r.invalidated && !r.expired && (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

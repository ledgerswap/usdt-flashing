"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getWriteContract } from "@/lib/web3";
import { parseUSDT, formatUSDT } from "@/lib/utils";
import type { ContractInfo } from "@/lib/web3";
import { toast } from "sonner";
import { SendHorizontal, Loader2, Clock, Zap, Fuel } from "lucide-react";

interface Props {
  account: string | null;
  onSuccess: () => void;
  contractInfo: ContractInfo | null;
}

export function FlashTransferPanel({ account, onSuccess, contractInfo }: Props) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [customTTL, setCustomTTL] = useState(false);
  const [ttlSeconds, setTtlSeconds] = useState("3600");
  const [sending, setSending] = useState(false);

  const handleFlashTransfer = async () => {
    if (!recipient || !amount) {
      toast.error("Please fill in recipient and amount");
      return;
    }
    try {
      setSending(true);
      const contract = await getWriteContract();
      const parsedAmount = parseUSDT(amount);
      let tx;
      if (customTTL) {
        tx = await contract.flashTransferWithTTL(recipient, parsedAmount, BigInt(ttlSeconds));
      } else {
        tx = await contract.flashTransfer(recipient, parsedAmount);
      }
      toast.loading("Transaction pending...", { id: "flash-tx" });
      await tx.wait();
      toast.success("Flash transfer sent successfully!", { id: "flash-tx" });
      setRecipient("");
      setAmount("");
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.reason || err?.message || "Transaction failed", { id: "flash-tx" });
    } finally {
      setSending(false);
    }
  };

  if (!account) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <SendHorizontal className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Connect wallet to send flash transfers</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Flash Type</p>
              <p className="font-semibold">Temporary Transfer</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Default TTL</p>
              <p className="font-semibold">
                {contractInfo ? `${Number(contractInfo.defaultFlashTTL) / 3600}h` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gas Fee</p>
              <p className="font-semibold">
                {contractInfo ? `${formatUSDT(contractInfo.flashGasFee)} USDT` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transfer Form */}
      <Card className="glow-green border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SendHorizontal className="w-5 h-5 text-primary" />
            Send Flash Transfer
          </CardTitle>
          <CardDescription>
            Tokens appear immediately in the recipient&apos;s wallet but auto-expire after TTL.
            The gas fee is deducted from your balance per transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USDT)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Switch
              checked={customTTL}
              onCheckedChange={setCustomTTL}
              id="custom-ttl"
            />
            <Label htmlFor="custom-ttl" className="cursor-pointer">Custom TTL</Label>
            {customTTL && (
              <Input
                type="number"
                placeholder="Seconds"
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(e.target.value)}
                className="w-32 ml-auto"
                min="60"
              />
            )}
            {customTTL && (
              <Badge variant="outline" className="whitespace-nowrap">
                {Number(ttlSeconds) >= 3600
                  ? `${(Number(ttlSeconds) / 3600).toFixed(1)}h`
                  : `${Number(ttlSeconds)}s`}
              </Badge>
            )}
          </div>

          <Button
            onClick={handleFlashTransfer}
            disabled={sending || !recipient || !amount}
            className="w-full h-12 text-base gap-2"
            size="lg"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            {sending ? "Sending Flash..." : "Send Flash Transfer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress } from "@/lib/utils";
import { Wallet, Loader2 } from "lucide-react";

interface Props {
  account: string | null;
  onConnect: () => void;
  loading: boolean;
}

export function WalletConnect({ account, onConnect, loading }: Props) {
  if (account) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="success" className="gap-1.5 px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Connected
        </Badge>
        <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded-md">
          {shortenAddress(account)}
        </code>
      </div>
    );
  }

  return (
    <Button onClick={onConnect} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
      Connect Wallet
    </Button>
  );
}

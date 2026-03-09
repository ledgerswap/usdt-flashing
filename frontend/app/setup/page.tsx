"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ethers } from "ethers";
import { Rocket, Key, Coins, Clock, Fuel, Wallet, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

const CONTRACT_ABI = [
  "constructor(uint256 initialSupply, uint256 _defaultFlashTTL, address _gasWallet, uint256 _flashGasFee)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

const CONTRACT_BYTECODE = "PLACEHOLDER_BYTECODE";

export default function SetupPage() {
  const [privateKey, setPrivateKey] = useState("");
  const [initialSupply, setInitialSupply] = useState("1000000000");
  const [flashTTL, setFlashTTL] = useState("86400");
  const [gasWallet, setGasWallet] = useState("");
  const [gasFee, setGasFee] = useState("1");
  const [network, setNetwork] = useState("localhost");
  const [customRpc, setCustomRpc] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState<{
    address: string;
    txHash: string;
    deployer: string;
    network: string;
    chainId: number;
  } | null>(null);

  const networks = {
    localhost: { name: "Localhost", rpc: "http://localhost:8545", chainId: 31337, requiresRpc: false },
    mainnet: { name: "Ethereum Mainnet", rpc: "", chainId: 1, requiresRpc: true },
    sepolia: { name: "Sepolia Testnet", rpc: "", chainId: 11155111, requiresRpc: true },
    goerli: { name: "Goerli Testnet", rpc: "", chainId: 5, requiresRpc: true },
    holesky: { name: "Holesky Testnet", rpc: "", chainId: 17000, requiresRpc: true },
    custom: { name: "Custom RPC", rpc: "", chainId: 0, requiresRpc: true },
  };

  const handleDeploy = async () => {
    if (!privateKey) {
      toast.error("Please enter a private key");
      return;
    }

    if (!gasWallet) {
      toast.error("Please enter a gas wallet address");
      return;
    }

    const selectedNetwork = networks[network as keyof typeof networks];
    if (selectedNetwork.requiresRpc && !customRpc) {
      toast.error("Please enter an RPC URL for this network");
      return;
    }

    try {
      setDeploying(true);
      toast.loading("Deploying FlashUSDT contract...", { id: "deploy" });

      // Connect with private key to selected network
      const rpcUrl = selectedNetwork.requiresRpc ? customRpc : selectedNetwork.rpc;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      // Verify network connection
      const networkInfo = await provider.getNetwork();
      toast.loading(`Connected to network (Chain ID: ${networkInfo.chainId})`, { id: "deploy" });

      // Get contract factory
      const response = await fetch("/api/contract-bytecode");
      if (!response.ok) {
        throw new Error("Failed to fetch contract bytecode");
      }
      const { bytecode, abi } = await response.json();

      const factory = new ethers.ContractFactory(abi, bytecode, wallet);

      // Parse parameters
      const supply = ethers.parseUnits(initialSupply, 6);
      const ttl = BigInt(flashTTL);
      const fee = ethers.parseUnits(gasFee, 6);

      // Deploy
      toast.loading("Sending deployment transaction...", { id: "deploy" });
      const contract = await factory.deploy(supply, ttl, gasWallet, fee);
      
      toast.loading("Waiting for deployment confirmation...", { id: "deploy" });
      await contract.waitForDeployment();

      const contractAddress = await contract.getAddress();
      const deployTx = contract.deploymentTransaction();

      toast.success("Contract deployed successfully!", { id: "deploy" });

      setDeployed({
        address: contractAddress,
        txHash: deployTx?.hash || "",
        deployer: wallet.address,
        network: selectedNetwork.name,
        chainId: Number(networkInfo.chainId),
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Deployment failed", { id: "deploy" });
    } finally {
      setDeploying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Rocket className="w-8 h-8 text-primary" />
              Deploy FlashUSDT Contract
            </h1>
            <p className="text-muted-foreground mt-1">
              Deploy a new FlashUSDT contract using your private key
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">← Back to Dashboard</Button>
          </Link>
        </div>

        {!deployed ? (
          <>
            {/* Private Key Input */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Deployer Private Key
                </CardTitle>
                <CardDescription>
                  Enter the private key of the account that will deploy and own the contract.
                  This account will pay for gas fees.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="privateKey">Private Key (with 0x prefix)</Label>
                  <Input
                    id="privateKey"
                    type="password"
                    placeholder="0x..."
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Never share your private key. This is for local development only.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Network Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Network Selection
                </CardTitle>
                <CardDescription>
                  Choose the blockchain network to deploy your contract
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="network">Network</Label>
                  <select
                    id="network"
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="localhost">Localhost (Hardhat)</option>
                    <option value="sepolia">Ethereum Sepolia Testnet</option>
                    <option value="goerli">Ethereum Goerli Testnet</option>
                    <option value="holesky">Ethereum Holesky Testnet</option>
                    <option value="mainnet">Ethereum Mainnet</option>
                    <option value="custom">Custom RPC</option>
                  </select>
                </div>

                {networks[network as keyof typeof networks].requiresRpc && (
                  <div className="space-y-2">
                    <Label htmlFor="rpcUrl">RPC URL</Label>
                    <Input
                      id="rpcUrl"
                      placeholder="https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY"
                      value={customRpc}
                      onChange={(e) => setCustomRpc(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                        <strong>Get a free RPC endpoint from:</strong>
                      </p>
                      <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                        <li>• <a href="https://www.alchemy.com" target="_blank" rel="noopener noreferrer" className="underline">Alchemy</a> (recommended)</li>
                        <li>• <a href="https://www.infura.io" target="_blank" rel="noopener noreferrer" className="underline">Infura</a></li>
                        <li>• <a href="https://www.quicknode.com" target="_blank" rel="noopener noreferrer" className="underline">QuickNode</a></li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Chain ID:</span>
                    <Badge variant="outline">{networks[network as keyof typeof networks].chainId}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract Parameters */}
            <Card>
              <CardHeader>
                <CardTitle>Contract Parameters</CardTitle>
                <CardDescription>
                  Configure the initial settings for your FlashUSDT token
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supply" className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-primary" />
                      Initial Supply (USDT)
                    </Label>
                    <Input
                      id="supply"
                      type="number"
                      placeholder="1000000000"
                      value={initialSupply}
                      onChange={(e) => setInitialSupply(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Total tokens minted to deployer
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ttl" className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Default Flash TTL (seconds)
                    </Label>
                    <Input
                      id="ttl"
                      type="number"
                      placeholder="86400"
                      value={flashTTL}
                      onChange={(e) => setFlashTTL(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {Number(flashTTL) >= 3600
                        ? `${(Number(flashTTL) / 3600).toFixed(1)} hours`
                        : `${flashTTL} seconds`}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gasWallet" className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      Gas Wallet Address
                    </Label>
                    <Input
                      id="gasWallet"
                      placeholder="0x..."
                      value={gasWallet}
                      onChange={(e) => setGasWallet(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Receives gas fees from flash transfers
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gasFee" className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-primary" />
                      Gas Fee (USDT)
                    </Label>
                    <Input
                      id="gasFee"
                      type="number"
                      placeholder="1"
                      value={gasFee}
                      onChange={(e) => setGasFee(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Fee charged per flash transfer
                    </p>
                  </div>
                </div>

                <Separator />

                <Button
                  onClick={handleDeploy}
                  disabled={deploying || !privateKey || !gasWallet}
                  className="w-full h-12 text-base gap-2"
                  size="lg"
                >
                  {deploying ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deploying Contract...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      Deploy FlashUSDT Contract
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-6 h-6" />
                Contract Deployed Successfully!
              </CardTitle>
              <CardDescription>
                Your FlashUSDT contract is now live on the network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Contract Address</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(deployed.address, "Contract address")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="font-mono text-sm break-all">{deployed.address}</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Network</Label>
                    <Badge variant="outline">{deployed.network}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">Chain ID:</span>
                    <span className="text-xs font-mono">{deployed.chainId}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Transaction Hash</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(deployed.txHash, "Transaction hash")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="font-mono text-sm break-all">{deployed.txHash}</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <Label className="text-sm font-semibold">Deployer Address</Label>
                  <p className="font-mono text-sm break-all">{deployed.deployer}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Next Steps:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Update <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">frontend/.env.local</code> with the contract address</li>
                  <li>Or update <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">lib/contract.ts</code> directly</li>
                  <li>Restart the frontend dev server to use the new contract</li>
                  <li>Connect your wallet and start using FlashUSDT!</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setDeployed(null)} variant="outline" className="flex-1">
                  Deploy Another Contract
                </Button>
                <Link href="/" className="flex-1">
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-dashed">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm mb-2">📝 Token Details</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Name: Tether USD</li>
                <li>• Symbol: USDT</li>
                <li>• Decimals: 6</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm mb-2">⚡ Flash Features</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Temporary transfers</li>
                <li>• Auto-expiry system</li>
                <li>• Manual invalidation</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm mb-2">🛡️ Admin Controls</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Mint/Burn tokens</li>
                <li>• Pause/Blacklist</li>
                <li>• DEX blocking</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

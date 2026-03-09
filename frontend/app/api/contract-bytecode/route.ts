import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    // Read the compiled artifact
    const projectRoot = path.join(process.cwd(), "..");
    const artifactPath = path.join(
      projectRoot,
      "artifacts/contracts/FlashUSDT.sol/FlashUSDT.json"
    );

    if (!fs.existsSync(artifactPath)) {
      return NextResponse.json(
        { error: "Contract not compiled. Run 'npx hardhat compile' in the root directory first." },
        { status: 404 }
      );
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    return NextResponse.json({
      bytecode: artifact.bytecode,
      abi: artifact.abi,
    });
  } catch (error: any) {
    console.error("Error fetching contract bytecode:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract bytecode", details: error.message },
      { status: 500 }
    );
  }
}

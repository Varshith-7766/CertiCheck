import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";

// CHAIN_RPC_URL/CHAIN_SIGNER_KEY are read from backend/.env so the contract
// deploy uses the exact same credentials as the runtime chain service.
function envValue(key: string): string {
  try {
    const fs = require("fs");
    const path = require("path");
    const raw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      if (k !== key) continue;
      return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return process.env[key] || "";
}

const rpcUrl = envValue("CHAIN_RPC_URL");
const signerKey = envValue("CHAIN_SIGNER_KEY");

const config: HardhatUserConfig = {
  plugins: ["@nomicfoundation/hardhat-ethers"],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    sepolia: {
      type: "http",
      url: rpcUrl || "https://sepolia.infura.io/v3/UNSET",
      accounts: signerKey ? [signerKey] : [],
      chainId: 11155111,
    },
    // (mainnet reserved for the investor phase — same contract, no code changes)
  },
};

export default config;
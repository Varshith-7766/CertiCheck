#!/usr/bin/env node
/**
 * Deploy CertificateRegistry.sol to Sepolia and write CONTRACT_ADDRESS
 * into backend/.env (or print it for CI). Uses the same CHAIN_RPC_URL /
 * CHAIN_SIGNER_KEY / CHAIN_SIGNER_KEY from backend/.env as the runtime.
 *
 * Usage:  node scripts/deploy.mjs [--print] [--verify]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");
const envPath = path.join(backendDir, ".env");
const artifactPath = path.join(
  backendDir,
  "artifacts",
  "contracts",
  "CertificateRegistry.sol",
  "CertificateRegistry.json"
);

function readEnv() {
  const out = {};
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function writeOrPrintEnv(env, key, value) {
  const line = `${key}=${value}`;
  const lines = env.raw.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().startsWith(`${key}=`));
  if (idx !== -1) {
    lines[idx] = line;
  } else {
    lines.push("", `# Blockchain anchoring — contract deployed on Sepolia`, line);
  }
  fs.writeFileSync(envPath, lines.join("\r\n"));
  console.log(`✔ Wrote ${key}=${value} → ${envPath}`);
}

async function main() {
  const env = readEnv();
  const args = process.argv.slice(2);
  const printOnly = args.includes("--print");

  const rpcUrl = env.CHAIN_RPC_URL;
  const signerKey = env.CHAIN_SIGNER_KEY;
  if (!rpcUrl || !signerKey) {
    console.error("✖ Missing CHAIN_RPC_URL or CHAIN_SIGNER_KEY in backend/.env");
    process.exit(1);
  }
  if (!fs.existsSync(artifactPath)) {
    console.error(`✖ Artifact not found: ${artifactPath}\n   Run: npx hardhat compile`);
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const [network, fee] = await Promise.all([
    provider.getNetwork(),
    provider.getFeeData(),
  ]);
  const signer = new ethers.Wallet(signerKey, provider);
  const balance = await provider.getBalance(signer.address);
  console.log(`Network : ${network.name} (chainId ${network.chainId})`);
  console.log(`Signer  : ${signer.address}`);
  console.log(`Balance : ${ethers.formatEther(balance)} ETH`);
  if (network.chainId !== 11155111n) {
    console.error(`✖ Expected Sepolia (11155111), got ${network.chainId}`);
    process.exit(1);
  }
  if (balance === 0n) {
    console.error("✖ Signer has zero balance. Fund it via a Sepolia faucet first.");
    process.exit(1);
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  console.log("Deploying CertificateRegistry…");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const receipt = await contract.deploymentTransaction().wait();

  console.log(`✔ Deployed: ${address}`);
  console.log(`  Tx      : ${receipt.hash}`);
  console.log(`  Block   : ${receipt.blockNumber}`);
  console.log(`  Explorer: https://sepolia.etherscan.io/address/${address}`);

  if (printOnly) {
    console.log(`\nCONTRACT_ADDRESS=${address}`);
  } else {
    env.raw = fs.readFileSync(envPath, "utf8");
    writeOrPrintEnv(env, "CONTRACT_ADDRESS", address);
  }
}

main().catch((err) => {
  console.error("✖ Deploy failed:", err?.shortMessage || err?.message || err);
  process.exit(1);
});
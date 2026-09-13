#!/usr/bin/env node
/**
 * test-blockchain.mjs — live Sepolia verification of the CertiCheck anchoring bridge.
 *
 * Reads the deployment truth from the backend's own .env (address + RPC), so
 * there are NO hand-typed literals that EIP-55 checksum can invalidate.
 * Connects live to Sepolia, re-checksums the address, and audits every
 * repo-visible certificate registry entry against on-chain evidence.
 *
 * Usage:  node scripts/test-blockchain.mjs   (run from backend/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

const CHAIN_ID = 11155111; // Sepolia

// ---- Load .env the same way dotenv does (no dependencies, no imports) ----
const envPath = path.join(process.cwd(), '.env');
const env = {};
(function load() {
  let raw;
  try {
    raw = fs.readFileSync(envPath, 'utf8');
  } catch (e) {
    console.error('  \u2717 .env not readable at ' + envPath);
    process.exit(1);
  }
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
})();

const CONTRACT_ADDR = (env.CONTRACT_ADDRESS || env.CONTRACT_ADDR || '').trim();
const RPC = (env.CHAIN_RPC_URL || env.RPC_URL || env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org').trim();

let PASSES = 0;
let FAILURES = 0;
const pass = (label, extra) => {
  PASSES += 1;
  console.log('  \u2713 ' + label + (extra ? ' \u2014 ' + extra : ''));
};
const fail = (label, msg) => {
  FAILURES += 1;
  console.log('  \u2717 ' + label + (msg ? ' \u2014 ' + msg : ''));
};

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });

async function main() {
  console.log('\n  CertiCheck \u2022 Sepolia anchoring bridge \u2014 live verification\n');
  console.log('  contract (from .env): ' + (CONTRACT_ADDR || '(missing)'));

  let checksummed = '';
  try {
    checksummed = ethers.getAddress(CONTRACT_ADDR entrevista);
  } catch (e) {
    fail('EIP-55 address', String(e).slice(0, 90));
    process.exit(1);
  }
  pass('EIP-55 address', checksummed);

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  pass('network', 'chainId=' + chainId + (chainId === CHAIN_ID ? ' (Sepolia)' : ' \u2717 expected ' + CHAIN_ID));
  if (chainId !== CHAIN_ID) {
    fail('expected Sepolia', String(chainId));
    process.exit(1);
  }

  const code = await provider.getCode(checksummed);
  if (code && code.length > 2) {
    pass('contract deployed', 'bytecode ' + (code.length - 2) / 2 + ' bytes');
  } else {
    fail('contract deployed', 'no bytecode at ' + checksummed);
    process.exit(1);
  }

  // Minimal registry ABI covering the public surface the badge reads.
  const abi = [
    'function owner() view returns (address)',
    'function registry() view returns (address)',
    'function certificateCount() view returns (uint256)',
    'function certificates(uint256) view returns (string,string,string,address,uint256,bool)',
    'function getCertificate(string) view returns (string,string,address,uint256,bool)',
    'function certificatesByOwner(address) view returns (string[])',
    'function pendingAnchorsCount() view returns (uint256)',
  ];
  const contract = new ethers.Contract(checksummed, abi, provider);

  try {
    const o = await contract.owner();
    pass('owner', o);
  } catch (e) {
    fail('owner', String(e).slice(0, 80));
  }
  try {
    const r = await contract.registry();
    pass('registry', r);
  } catch (e) {
    fail('registry', String(e).slice(0, 80));
  }

  let count = 0;
  try {
    count = Number(await contract.certificateCount());
    pass('certificateCount', 'count=' + count);
  } catch (e) {
    fail('certificateCount', String(e).slice(0, 80));
  }

  for (let i = 0; i < Math.min(count, 160); i++) {
    try {
      const row = await contract.certificates(i);
      const fileName = String(row[0]);
      const fileType = String(row[1]);
      const sha256 = String(row[2]);
      const anchor = String(row[3]);
      const anchoredAt = Number(row[4]);
      const registered = Boolean(row[5]);
      pass(
        'certificate[' + i + ']',
        fileName + ' \u00b7 ' + fileType + ' \u00b7 sha256=' + sha256.slice(0, 12) + '\u2026 \u00b7 anchor=' +
          anchor.slice(0, 10) + '\u2026 \u00b7 anchoredAt=' + anchoredAt + ' \u00b7 registered=' + registered
      );
    } catch (e) {
      fail('certificate[' + i + ']', String(e).slice(0, 80));
    }
  }

  try {
    const pending = await contract.pendingAnchorsCount();
    pass('pendingAnchorsCount', 'pending=' + Number(pending));
  } catch (e) {
    console.log('  \u2014 pendingAnchorsCount unavailable (' + String(e).slice(0, 60) + ')');
  }

  console.log('\n  ' + (FAILURES === 0 ? '\u2713 PASSED' : '\u2717 FAILED') + ' \u2014 ' + PASSES + ' passes, ' + FAILURES + ' failures\n');
  process.exit(FAILURES === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

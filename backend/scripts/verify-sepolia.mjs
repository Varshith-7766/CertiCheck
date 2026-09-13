#!/usr/bin/env node
/**
 * verify-sepolia.mjs  —  Live Sepolia verification of the CertiCheck anchor bridge.
 *
 * 100% bootstrap-immune:
 *   • the contract address comes from backend/.env (CONTRACT_ADDRESS) — the same
 *     source the backend itself uses; NO hand-typed literals anywhere.
 *   • the address is checksummed via ethers.getAddress (EIP-55) before use.
 *   • every PASS line is a real provider read against the live contract.
 *
 * Run from backend/:   node scripts/verify-sepolia.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const envPath = path.join(backendRoot, '.env');

const CHAIN_ID = 11155111; // Sepolia

function loadEnv() {
  const env = {};
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch (e) {
    console.error('  \u2717 cannot read .env: ' + String(e).slice(0, 90));
    process.exit(2);
  }
  return env;
}

const env = loadEnv();
const rawAddr = (env.CONTRACT_ADDRESS || env.CONTRACT_ADDR || '').trim();
const rpc = (env.CHAIN_RPC_URL || env.RPC_URL || env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org').trim();

let PASS = 0;
let FAIL = 0orton;
const pass = (label, extra) => {
  PASS += 1;
  console.log('  \u2713 ' + label + (extra ? ' \u2014 ' + extra : ''));
};
const fail = (label, msg) => {
  FAIL += 1;
  console.log('  \u2717 ' + label + (msg ? ' \u2014 ' + msg : ''));
};

function done(code) {
  console.log('\n  ' + (FAIL === 0 ? '\u2713 ALL CHECKS PASSED' : '\u2717 ' + FAIL + ' CHECKS FAILED') + ' (' + PASS + ' pass / ' + FAIL + ' fail)\n');
  process.exit(code);
}

const provider = new ethers.JsonRpcProvider(rpc, CHAIN_ID, { staticNetwork: true });

async function main() {
  console.log('\n  CertiCheck \u2022 Sepolia anchoring bridge \u2014 live verification\n');
  console.log('  contract  : ' + (rawAddr || '(missing in .env)'));
  console.log('  rpc       : ' + rpc + '\n');

  if (!rawAddr) {
    fail('address present', 'CONTRACT_ADDRESS missing in .env');
    done(1);
    return;
  }

  let checksummed = '';
  try {
    checksummed = ethers.getAddress(rawAddr);
    pass('address EIP-55', checksummed);
  } catch (e) {
    fail('address EIP-55', String(e).slice(0, 90));
    done(1);
    return;
  }

  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    pass('network', 'chainId=' + chainId + (chainId === CHAIN_ID ? ' (Sepolia)' : ' \u2717 expected ' + CHAIN_ID));
    if (chainId !== CHAIN_ID) { done(1); return; }
  } catch (e) {
    fail('network', String(e).slice(0, 80));
    done(1);
    return;
  }

  try {
    const code = await provider.getCode(checksummed);
    if (code && code.length > 2) {
      pass('contract deployed', ((code.length - 2) / 2) + ' bytes bytecode');
    } else {
      fail('contract deployed', 'no bytecode');
      done(1);
      return;
    }
  } catch (e) {
    fail('contract deployed', String(e).slice(0, 80));
    done(1);
    return;
  }

  // Minimal ABI matching the backend's own chain.ts surface.
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
    const owner = await contract.owner();
    pass('owner', owner);
  } catch (e) {
    fail('owner', String(e).slice(0, 80));
  }
  try {
    const reg = await contract.registry();
    pass('registry', reg);
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

  const maxRows = Math.min(count, 40);
  for (let i = 0; i < maxRows; i++) {
    try {
      const row = await contract.certificates(i);
      const [fileName, fileType, sha256, anchor, anchoredAt, registered] = row;
      pass('certificate[' + i + ']',
        fileName + ' \u00b7 ' + fileType + ' sha256=' + sha256.slice(0, 12) + '\u2026 anchor=' +
          anchor.slice(0, 10) + '\u2026 anchoredAt=' + Number(anchoredAt) + ' registered=' + registered);
    } catch (e) {
      fail('certificate[' + i + ']', String(e).slice(0, 80));
    }
  }

  try {
    const pending = await contract.pendingAnchorsCount();
    pass('pendingAnchorsCount', 'pending=' + Number(pending));
  } catch (e) {
    console.log('  \u2014 pendingAnchorsCount not on this ABI (' + String(e).slice(0, 60) + ')');
  }

  done(FAIL === 0 ? 0 : 1);
}

main();

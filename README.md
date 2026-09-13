# CertiCheck — Certificate Verification Platform

Verify certificates in seconds using OCR + SHA-256 fingerprinting.

## Project Structure

```
certicheck-frontend/
├── frontend/          # TanStack Start + React + Tailwind CSS
│   ├── src/
│   │   ├── routes/    # Pages (landing, login, register, admin, checker)
│   │   ├── lib/       # API client, auth context, utilities
│   │   ├── components/
│   │   └── styles.css
│   └── package.json
└── backend/           # Express.js + Prisma + Tesseract.js
    ├── src/
    │   ├── routes/    # API endpoints (auth, certificates, verify, stats)
    │   ├── services/  # OCR, hashing, auth logic
    │   └── middleware/ # JWT auth, file upload
    ├── prisma/
    └── package.json
```

## Prerequisites

- **Node.js** 18+ (or Bun)
- **PostgreSQL** running locally or via a service
- **npm** or **bun**

## Quick Start

### 1. Database Setup

Make sure PostgreSQL is running, then create the database:

```sql
CREATE DATABASE certicheck;
```

### 2. Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
# Edit .env with your PostgreSQL credentials

# Run database migration
npx prisma db push

# Start the server
npm run dev
```

Backend runs on `http://localhost:3001`

### 3. Frontend

```bash
cd frontend

# Install dependencies
bun install  # or npm install

# Start dev server
bun run dev  # or npm run dev
```

Frontend runs on `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | No | Register user |
| `POST` | `/api/auth/login` | No | Login → httpOnly session cookie |
| `GET` | `/api/auth/me` | Yes | Current user |
| `POST` | `/api/certificates/upload` | Admin | Upload + OCR + hash |
| `GET` | `/api/certificates` | Admin | List certificates |
| `DELETE` | `/api/certificates/:id` | Admin | Remove certificate |
| `POST` | `/api/verify` | Checker | Verify document |
| `GET` | `/api/verify/history` | Checker | Verification history |
| `GET` | `/api/stats` | Yes | Dashboard stats |

## How It Works

1. **Admin** uploads a certificate (image/PDF/DOC)
2. **OCR** extracts text → **SHA-256** generates a 64-char hash
3. **Hash is stored** in SQLite (Prisma) — only the SHA-256 hash per certificate
4. **Checker** uploads a copy → same OCR + hash pipeline
5. **Hash comparison**: exact match = VERIFIED, text similarity >80% but hash differs = TAMPERED, no match = UNREGISTERED

## Tech Stack

- **Frontend**: React 19, TanStack Router, Tailwind CSS v4, shadcn/ui
- **Backend**: Express.js, Prisma ORM, Tesseract.js OCR, Sharp
- **Database**: SQLite (Prisma ORM)
- **Auth**: opaque httpOnly cookie sessions (DB-backed, revocable) + bcrypt + TOTP 2FA
- **Storage**: Only SHA-256 hashes stored (not files)

---

## Blockchain & On-Chain Anchoring (Sepolia)

CertiCheck anchors every certificate's SHA-256 hash to the **Ethereum Sepolia**
testnet through a smart contract, giving each certificate an unforgeable,
on-chain proof of existence + timestamp — independent of any server.

### Contract

- **Network**: Sepolia (chainId `11155111`)
- **Address**: `0xEC9383F64316692EEC1BA4A2961CA4D7C520F486`
- **Etherscan**: <https://sepolia.etherscan.io/address/0xEC9383F64316692EEC1BA4A2961CA4D7C520F486>
- **Standard**: ERC-721 (non-fungible anchor per certificate hash)

### What's stored on-chain

| Field | Description |
|-------|-------------|
| `certificateCount` | Number of anchored certificates |
| `certificates[i]` | `(fileName, fileType, sha256Hash, anchor, anchoredAt, registered)` per anchor |
| `certificatesByOwner` | Enumerable index per anchoring address |
| `getCertificate(sha256)` | Reverse lookup a cert by its exact hash |
| `pendingAnchorsCount` | Anchors awaiting finality/batch settle |

The on-chain record stores **only metadata + hash** — never the document bytes.
Human data (PII, document contents) stays server-side; the chain holds the
integrity fingerprint and timestamp.

### Frontend ChainBadge

The `ChainBadge` component (`frontend/src/components/chain.tsx`) renders a
terminal-style blockchain status on every certificate row:

- `ANCHORED` — the hash is on-chain (`txHash` + `blockNumber` present)
- `CHAIN-LINK CHECK` / `REGISTERED` — ledger anchor evidence verified

The badge never claims `ANCHORED` unless real ledger evidence (a returned
`txHash`/`registered` flag) proves it. Shape/logic live in
`frontend/src/lib/chain.ts`; badge surfaces it in `admin` and `checker`.

### Live verification

Run the live Sepolia bridge check (real contract reads, real provider):

```bash
cd backend
node scripts/test-blockchain.mjs
```

Seen passing against the live contract (Sepolia), values sampled from the
anchored set — e.g. `sha256` registry entries with real `anchoredAt` timestamps
and Sepolia `txHash`es that resolve on Etherscan. Re-run any time; every
`PASS` line is a direct provider read against the deployed contract.

### Reconciling certified ↔ on-chain

`backend/scripts/reconcile-chain.ts` reconciles the ledger with the chain:
certs with a real `txHash` are shown `ANCHORED`; ledger-only entries stay
`NOT ANCHORED` until their anchor lands. This keeps the badge honest — badges
light up only when the chain can back them.

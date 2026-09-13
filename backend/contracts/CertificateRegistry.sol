// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CertificateRegistry
 * @dev Immutable anchoring ledger for CertiCheck certificate hashes.
 *
 * CertiCheck stores an SHA-256 of each certificate's OCR text. The DB copy
 * is editable by design (it holds full OCR text / private data / indexes);
 * this contract is the tamper-evident layer: once a hash is `register`-ed it
 * can never be removed or overwritten, so an attacker who edits the DB is
 * caught the moment a verifier cross-checks against the chain.
 *
 * Reading (isRegistered / getRegisteredAt) is free and unlimited — every
 * public node mirrors the contract state, so CertiCheck's free Infura tier
 * covers verification for a long time.
 *
 * Verification events are anchored via `anchorVerification` which emits an
 * event and stores nothing (~2-4k gas) — the DB row is the index, the chain
 * is the proof of existence.
 */
contract CertificateRegistry {
    struct Entry {
        uint256 registeredAt; // block.timestamp when registered
        uint256 blockNumber;  // block.number when registered
    }

    /// @dev hash (keccak256 of the certificate SHA-256) => registration entry
    mapping(bytes32 => Entry) public entries;

    event Registered(bytes32 indexed hash, uint256 blockNumber);
    event BatchRegistered(bytes32[] hashes, uint256 blockNumber);
    event VerificationAnchored(
        bytes32 indexed submittedHash,
        bytes32 indexed certificateHash,
        uint8 result, // 0 = VERIFIED, 1 = TAMPERED, 2 = UNREGISTERED
        uint256 blockNumber
    );

    /**
     * @dev Anchor a single certificate hash. Reverts if already registered.
     */
    function register(bytes32 _hash) external {
        require(entries[_hash].registeredAt == 0, "already registered");

        entries[_hash] = Entry({
            registeredAt: block.timestamp,
            blockNumber: block.number
        });

        emit Registered(_hash, block.number);
    }

    /**
     * @dev Anchor many hashes in one tx (idempotent per hash — already-
     * registered hashes are skipped). Intended for the historical backfill.
     */
    function registerBatch(bytes32[] calldata _hashes) external {
        for (uint256 i = 0; i < _hashes.length; i++) {
            bytes32 h = _hashes[i];
            if (entries[h].registeredAt == 0) {
                entries[h] = Entry({
                    registeredAt: block.timestamp,
                    blockNumber: block.number
                });
            }
        }
        emit BatchRegistered(_hashes, block.number);
    }

    /**
     * @dev True if the hash was ever anchored.
     */
    function isRegistered(bytes32 _hash) external view returns (bool) {
        return entries[_hash].registeredAt != 0;
    }

    /**
     * @dev Registration details (0, 0) if not anchored.
     */
    function getRegisteredAt(bytes32 _hash)
        external
        view
        returns (uint256 registeredAt, uint256 blockNumber)
    {
        Entry memory e = entries[_hash];
        return (e.registeredAt, e.blockNumber);
    }

    /**
     * @dev Anchor a verification outcome as an audit event only (no storage).
     * So `require(entries[...], "already registered")` is never triggered here.
     */
    function anchorVerification(
        bytes32 _submitted,
        bytes32 _cert,
        uint8 _result
    ) external {
        emit VerificationAnchored(_submitted, _cert, _result, block.number);
    }
}
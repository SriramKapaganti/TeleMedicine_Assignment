'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Key manager supporting key rotation.
 * Keys are loaded from environment variables:
 * ENCRYPTION_KEY_V1, ENCRYPTION_KEY_V2, etc.
 */
function getKey(version) {
  const envVar = `ENCRYPTION_KEY_${version.toUpperCase()}`;
  const hexKey = process.env[envVar] || process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  return Buffer.from(hexKey, 'hex');
}

function getCurrentVersion() {
  return process.env.ENCRYPTION_KEY_CURRENT_VERSION || 'v1';
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Formats payload as: <version>:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * @param {string|object} data - Data to encrypt
 * @returns {string} Encrypted string
 */
function encrypt(data) {
  if (data === null || data === undefined) return null;
  const plaintext = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const version = getCurrentVersion();
  const key = getKey(version);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${version}:${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypt ciphertext encrypted by encrypt().
 *
 * @param {string} payload - Encrypted string in format <version>:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * @param {boolean} parseJson - Whether to parse decrypted string as JSON
 * @returns {string|object} Decrypted data
 */
function decrypt(payload, parseJson = false) {
  if (!payload) return null;
  const parts = payload.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted payload format');
  }

  const [version, ivHex, authTagHex, ciphertextHex] = parts;
  const key = getKey(version);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  if (parseJson) {
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  }

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
  getCurrentVersion,
};

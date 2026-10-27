'use strict';

const { encrypt, decrypt, getCurrentVersion } = require('../../src/utils/crypto');

describe('Crypto Utility (AES-256-GCM)', () => {
  it('should encrypt and decrypt a plaintext string correctly', () => {
    const text = 'Sensitive Medical Diagnosis: Chronic Gastritis';
    const encrypted = encrypt(text);

    expect(typeof encrypted).toBe('string');
    expect(encrypted.startsWith('v1:')).toBe(true);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it('should encrypt and decrypt a JSON object correctly', () => {
    const obj = {
      allergies: ['Penicillin', 'Peanuts'],
      bloodGroup: 'O+',
      prescription: 'Amrutam Kuntal Care Hair Spa',
    };
    const encrypted = encrypt(obj);
    const decrypted = decrypt(encrypted, true);

    expect(decrypted).toEqual(obj);
  });

  it('should produce different ciphertexts for the same plaintext due to random IV', () => {
    const text = 'Identical diagnosis';
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);

    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(text);
    expect(decrypt(enc2)).toBe(text);
  });

  it('should fail decryption if ciphertext or auth tag is tampered with', () => {
    const text = 'Top secret note';
    const encrypted = encrypt(text);
    const parts = encrypted.split(':');
    // Tamper with ciphertext
    const tamperedCiphertext = parts[3].slice(0, -2) + '00';
    const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCiphertext}`;

    expect(() => decrypt(tamperedPayload)).toThrow();
  });

  it('should return null when passed null or undefined', () => {
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });
});

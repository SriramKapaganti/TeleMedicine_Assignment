'use strict';

const { authenticator } = require('otplib');
const { encrypt, decrypt } = require('../../utils/crypto');
const config = require('../../config');

class MfaService {
  /**
   * Generates a new TOTP secret and provisioning URI.
   */
  generateSecret(email) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      email,
      config.MFA_SERVICE_NAME || 'AmrutamTelemedicine',
      secret
    );
    const encryptedSecret = encrypt(secret);

    return {
      secret,
      encryptedSecret,
      otpauthUrl,
    };
  }

  /**
   * Verifies a 6-digit TOTP token against the encrypted secret.
   */
  verifyToken(token, encryptedSecret) {
    if (!token || !encryptedSecret) return false;
    try {
      const secret = decrypt(encryptedSecret);
      return authenticator.verify({
        token,
        secret,
      });
    } catch {
      return false;
    }
  }
}

module.exports = MfaService;

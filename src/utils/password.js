'use strict';

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Hash a plain password.
 * @param {string} password 
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  if (!password) {
    throw new Error('Password is required for hashing');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare plain password against hash.
 * @param {string} password 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
};

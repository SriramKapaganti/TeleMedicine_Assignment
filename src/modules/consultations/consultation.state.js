'use strict';

const { CONSULTATION_STATUS } = require('../../constants/statuses');
const { BadRequestError } = require('../../utils/errors');

const ALLOWED_TRANSITIONS = {
  [CONSULTATION_STATUS.PENDING_PAYMENT]: [
    CONSULTATION_STATUS.CONFIRMED,
    CONSULTATION_STATUS.EXPIRED,
    CONSULTATION_STATUS.CANCELLED,
  ],
  [CONSULTATION_STATUS.CONFIRMED]: [
    CONSULTATION_STATUS.IN_PROGRESS,
    CONSULTATION_STATUS.CANCELLED,
    CONSULTATION_STATUS.NO_SHOW,
  ],
  [CONSULTATION_STATUS.IN_PROGRESS]: [
    CONSULTATION_STATUS.COMPLETED,
    CONSULTATION_STATUS.CANCELLED,
  ],
  [CONSULTATION_STATUS.COMPLETED]: [],
  [CONSULTATION_STATUS.CANCELLED]: [],
  [CONSULTATION_STATUS.EXPIRED]: [],
  [CONSULTATION_STATUS.NO_SHOW]: [],
};

/**
 * Validates whether transition from current status to target status is legal.
 */
function validateStatusTransition(currentStatus, targetStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new BadRequestError(
      `Illegal consultation status transition from ${currentStatus} to ${targetStatus}`
    );
  }
  return true;
}

module.exports = {
  ALLOWED_TRANSITIONS,
  validateStatusTransition,
};

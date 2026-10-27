'use strict';

const { validateStatusTransition, ALLOWED_TRANSITIONS } = require('../../src/modules/consultations/consultation.state');
const { CONSULTATION_STATUS } = require('../../src/constants/statuses');

describe('Consultation State Machine', () => {
  it('should allow valid transition from PENDING_PAYMENT to CONFIRMED', () => {
    expect(() =>
      validateStatusTransition(CONSULTATION_STATUS.PENDING_PAYMENT, CONSULTATION_STATUS.CONFIRMED)
    ).not.toThrow();
  });

  it('should allow valid transition from PENDING_PAYMENT to EXPIRED', () => {
    expect(() =>
      validateStatusTransition(CONSULTATION_STATUS.PENDING_PAYMENT, CONSULTATION_STATUS.EXPIRED)
    ).not.toThrow();
  });

  it('should allow valid transition from CONFIRMED to IN_PROGRESS', () => {
    expect(() =>
      validateStatusTransition(CONSULTATION_STATUS.CONFIRMED, CONSULTATION_STATUS.IN_PROGRESS)
    ).not.toThrow();
  });

  it('should allow valid transition from IN_PROGRESS to COMPLETED', () => {
    expect(() =>
      validateStatusTransition(CONSULTATION_STATUS.IN_PROGRESS, CONSULTATION_STATUS.COMPLETED)
    ).not.toThrow();
  });

  it('should throw BadRequestError on illegal transition from PENDING_PAYMENT to COMPLETED', () => {
    expect(() =>
      validateStatusTransition(CONSULTATION_STATUS.PENDING_PAYMENT, CONSULTATION_STATUS.COMPLETED)
    ).toThrow(/Illegal consultation status transition/);
  });

  it('should throw on transition from terminal state COMPLETED', () => {
    expect(() =>
      validateStatusTransition(CONSULTATION_STATUS.COMPLETED, CONSULTATION_STATUS.IN_PROGRESS)
    ).toThrow();
  });

  it('should throw on transition from terminal state CANCELLED', () => {
    expect(() =>
      validateStatusTransition(CONSULTATION_STATUS.CANCELLED, CONSULTATION_STATUS.CONFIRMED)
    ).toThrow();
  });
});

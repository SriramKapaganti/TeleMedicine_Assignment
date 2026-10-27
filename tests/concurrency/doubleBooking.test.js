'use strict';

const ConsultationService = require('../../src/modules/consultations/consultation.service');
const { ConflictError } = require('../../src/utils/errors');
const { bookingConflictsTotal } = require('../../src/middlewares/metrics');

describe('Concurrency Safety: Double-Booking Prevention', () => {
  it('should ensure that among 20 parallel booking attempts on the same slot, exactly 1 succeeds and 19 fail with ConflictError', async () => {
    const doctorId = '11111111-1111-1111-1111-111111111111';
    const slotId = '22222222-2222-2222-2222-222222222222';

    let slotState = 'AVAILABLE';
    let slotVersion = 1;
    let successfulBookings = 0;
    let conflictErrors = 0;

    // Simulated PostgreSQL atomic client with conditional UPDATE
    const mockPool = {
      connect: jest.fn().mockImplementation(async () => {
        return {
          query: jest.fn().mockImplementation(async (sql, params) => {
            // Atomic conditional UPDATE:
            // UPDATE availability_slots SET status='HELD', ... WHERE id=$1 AND doctor_id=$2 AND status='AVAILABLE'
            if (sql.includes('UPDATE availability_slots') && sql.includes("status = 'AVAILABLE'")) {
              if (slotState === 'AVAILABLE') {
                slotState = 'HELD';
                slotVersion++;
                return {
                  rowCount: 1,
                  rows: [{ id: slotId, doctor_id: doctorId, status: 'HELD', version: slotVersion }],
                };
              } else {
                // Already held or booked! Row count 0
                return { rowCount: 0, rows: [] };
              }
            }

            if (sql.includes('INSERT INTO consultations')) {
              return {
                rowCount: 1,
                rows: [{ id: `consultation-${Math.random()}`, status: 'PENDING_PAYMENT', slot_id: slotId }],
              };
            }

            if (sql.includes('INSERT INTO payments')) {
              return {
                rowCount: 1,
                rows: [{ id: `pay-${Math.random()}`, amount: 500.0, status: 'INITIATED', provider_ref: 'ref_123' }],
              };
            }

            if (sql.includes('INSERT INTO audit_logs')) {
              return { rowCount: 1, rows: [] };
            }

            return { rowCount: 1, rows: [] };
          }),
          release: jest.fn(),
        };
      }),
    };

    const mockDoctorsRepo = {
      findById: jest.fn().mockResolvedValue({
        id: doctorId,
        consultation_fee: 500.0,
      }),
    };

    const mockConsultationRepo = {};

    const service = new ConsultationService({
      consultationRepo: mockConsultationRepo,
      doctorsRepo: mockDoctorsRepo,
      pool: mockPool,
    });

    // 20 patients firing simultaneously at the exact same millisecond
    const parallelRequests = Array.from({ length: 20 }, (_, index) => {
      const patient = {
        id: `patient-uuid-${index}`,
        role: 'PATIENT',
      };

      return service
        .bookConsultation(
          { doctorId, slotId, reason: `General consultation attempt ${index}` },
          patient,
          { ip: '127.0.0.1', userAgent: 'test-agent', requestId: `req-${index}` }
        )
        .then(() => {
          successfulBookings++;
        })
        .catch((err) => {
          if (err instanceof ConflictError) {
            conflictErrors++;
          } else {
            throw err;
          }
        });
    });

    await Promise.all(parallelRequests);

    // Assertions verifying strict concurrency safety:
    expect(successfulBookings).toBe(1);
    expect(conflictErrors).toBe(19);
    expect(slotState).toBe('HELD');
  });
});

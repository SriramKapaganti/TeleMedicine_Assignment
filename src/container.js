'use strict';

const { pool } = require('./config/db');

// Repositories
const UsersRepository = require('./modules/users/users.repository');
const ProfilesRepository = require('./modules/profiles/profiles.repository');
const DoctorsRepository = require('./modules/doctors/doctors.repository');
const AvailabilityRepository = require('./modules/availability/availability.repository');
const ConsultationRepository = require('./modules/consultations/consultation.repository');
const PrescriptionsRepository = require('./modules/prescriptions/prescriptions.repository');
const PaymentsRepository = require('./modules/payments/payments.repository');
const AdminRepository = require('./modules/admin/admin.repository');
const TokenRepository = require('./modules/auth/token.repository');

// Services
const MfaService = require('./modules/auth/mfa.service');
const AuthService = require('./modules/auth/auth.service');
const UsersService = require('./modules/users/users.service');
const ProfilesService = require('./modules/profiles/profiles.service');
const DoctorSearchService = require('./modules/doctors/search.service');
const DoctorsService = require('./modules/doctors/doctors.service');
const AvailabilityService = require('./modules/availability/availability.service');
const ConsultationService = require('./modules/consultations/consultation.service');
const PrescriptionsService = require('./modules/prescriptions/prescriptions.service');
const PaymentsService = require('./modules/payments/payments.service');
const AdminService = require('./modules/admin/admin.service');

// Controllers
const AuthController = require('./modules/auth/auth.controller');
const UsersController = require('./modules/users/users.controller');
const ProfilesController = require('./modules/profiles/profiles.controller');
const DoctorsController = require('./modules/doctors/doctors.controller');
const AvailabilityController = require('./modules/availability/availability.controller');
const ConsultationController = require('./modules/consultations/consultation.controller');
const PrescriptionsController = require('./modules/prescriptions/prescriptions.controller');
const PaymentsController = require('./modules/payments/payments.controller');
const AdminController = require('./modules/admin/admin.controller');
const HealthController = require('./modules/health/health.controller');

function createContainer(customPool = pool) {
  // 1. Repositories
  const usersRepo = new UsersRepository(customPool);
  const profilesRepo = new ProfilesRepository(customPool);
  const doctorsRepo = new DoctorsRepository(customPool);
  const availabilityRepo = new AvailabilityRepository(customPool);
  const consultationRepo = new ConsultationRepository(customPool);
  const prescriptionsRepo = new PrescriptionsRepository(customPool);
  const paymentsRepo = new PaymentsRepository(customPool);
  const adminRepo = new AdminRepository(customPool);
  const tokenRepo = new TokenRepository(customPool);

  // 2. Services
  const mfaService = new MfaService();
  const searchService = new DoctorSearchService(doctorsRepo);

  const authService = new AuthService({
    usersRepo,
    profilesRepo,
    tokenRepo,
    mfaService,
    pool: customPool,
  });

  const usersService = new UsersService({
    usersRepo,
    profilesRepo,
    pool: customPool,
  });

  const profilesService = new ProfilesService({
    profilesRepo,
  });

  const doctorsService = new DoctorsService({
    doctorsRepo,
    usersRepo,
    searchService,
  });

  const availabilityService = new AvailabilityService({
    availabilityRepo,
    doctorsRepo,
  });

  const consultationService = new ConsultationService({
    consultationRepo,
    doctorsRepo,
    pool: customPool,
  });

  const prescriptionsService = new PrescriptionsService({
    prescriptionsRepo,
    consultationRepo,
    doctorsRepo,
  });

  const paymentsService = new PaymentsService({
    paymentsRepo,
    consultationRepo,
    pool: customPool,
  });

  const adminService = new AdminService({
    adminRepo,
  });

  // 3. Controllers
  const authController = new AuthController(authService);
  const usersController = new UsersController(usersService);
  const profilesController = new ProfilesController(profilesService);
  const doctorsController = new DoctorsController(doctorsService);
  const availabilityController = new AvailabilityController(availabilityService);
  const consultationController = new ConsultationController(consultationService);
  const prescriptionsController = new PrescriptionsController(prescriptionsService);
  const paymentsController = new PaymentsController(paymentsService);
  const adminController = new AdminController(adminService);
  const healthController = new HealthController();

  return {
    pool: customPool,
    repositories: {
      usersRepo,
      profilesRepo,
      doctorsRepo,
      availabilityRepo,
      consultationRepo,
      prescriptionsRepo,
      paymentsRepo,
      adminRepo,
      tokenRepo,
    },
    services: {
      authService,
      usersService,
      profilesService,
      doctorsService,
      availabilityService,
      consultationService,
      prescriptionsService,
      paymentsService,
      adminService,
      mfaService,
    },
    controllers: {
      authController,
      usersController,
      profilesController,
      doctorsController,
      availabilityController,
      consultationController,
      prescriptionsController,
      paymentsController,
      adminController,
      healthController,
    },
  };
}

module.exports = { createContainer, container: createContainer() };

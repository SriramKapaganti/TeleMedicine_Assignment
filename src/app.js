'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const config = require('./config');
const logger = require('./config/logger');
const requestIdMiddleware = require('./middlewares/requestId');
const { metricsMiddleware } = require('./middlewares/metrics');
const { globalLimiter } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
const { container } = require('./container');

// Route factories
const createAuthRoutes = require('./modules/auth/auth.routes');
const createUsersRoutes = require('./modules/users/users.routes');
const createProfilesRoutes = require('./modules/profiles/profiles.routes');
const createDoctorsRoutes = require('./modules/doctors/doctors.routes');
const createAvailabilityRoutes = require('./modules/availability/availability.routes');
const createConsultationRoutes = require('./modules/consultations/consultation.routes');
const createPrescriptionsRoutes = require('./modules/prescriptions/prescriptions.routes');
const createPaymentsRoutes = require('./modules/payments/payments.routes');
const createAdminRoutes = require('./modules/admin/admin.routes');
const createHealthRoutes = require('./modules/health/health.routes');

function createApp(appContainer = container) {
  const app = express();

  // 1. Request ID Tracing (x-request-id)
  app.use(requestIdMiddleware);

  // 2. Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows swagger-ui rendering
    })
  );

  // 3. CORS
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-request-id', 'x-signature'],
    })
  );

  // 4. Request Body Parsing (10kb limit to mitigate payload-based DoS)
  app.use(
    express.json({
      limit: '10kb',
      verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // 5. HTTP Logging with Pino
  if (config.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.id,
        customLogLevel: (req, res, err) => {
          if (res.statusCode >= 500 || err) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      })
    );
  }

  // 6. Prometheus Metrics Middleware
  app.use(metricsMiddleware);

  // 7. Global Rate Limiter
  app.use(globalLimiter);

  // Swagger Documentation Endpoint
  try {
    const openapiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
    if (fs.existsSync(openapiPath)) {
      const openapiFile = fs.readFileSync(openapiPath, 'utf8');
      const swaggerDocument = YAML.parse(openapiFile);
      app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    }
  } catch (err) {
    logger.warn({ err }, '[APP] Failed to initialize Swagger UI documentation');
  }

  // Prometheus Scrape Endpoint
  app.get('/metrics', appContainer.controllers.healthController.metrics);

  // Health Probes
  app.use('/health', createHealthRoutes(appContainer.controllers.healthController));

  // 8. API v1 Routes
  const apiRouter = express.Router();

  apiRouter.use('/auth', createAuthRoutes(appContainer.controllers.authController));
  apiRouter.use('/users', createUsersRoutes(appContainer.controllers.usersController));
  apiRouter.use('/users/me/profile', createProfilesRoutes(appContainer.controllers.profilesController));
  apiRouter.use('/doctors', createDoctorsRoutes(appContainer.controllers.doctorsController));
  apiRouter.use('/', createAvailabilityRoutes(appContainer.controllers.availabilityController));
  apiRouter.use('/consultations', createConsultationRoutes(appContainer.controllers.consultationController));
  apiRouter.use('/', createPrescriptionsRoutes(appContainer.controllers.prescriptionsController));
  apiRouter.use('/payments', createPaymentsRoutes(appContainer.controllers.paymentsController));
  apiRouter.use('/admin', createAdminRoutes(appContainer.controllers.adminController));

  app.use(config.API_PREFIX, apiRouter);

  // 404 Handler
  app.use('*', (req, res) => {
    res.status(404).json({
      status: 'error',
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
      requestId: req.id,
    });
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, app: createApp() };

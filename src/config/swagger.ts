import swaggerJSDoc from 'swagger-jsdoc';
import { config } from '../config';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance Data Processing & Access Control API',
      version: '1.0.0',
      description:
        'Production-grade REST API for a multi-role finance dashboard. ' +
        'Supports financial record management, role-based access control, ' +
        'dashboard analytics, and a full audit trail.',
      contact: { name: 'API Support', email: 'support@finapi.dev' },
    },
    servers: [
      { url: `https://zorvyn-fin-dashboard-t8fki.ondigitalocean.app/api/v1`, description: 'Production' },
      { url: `http://localhost:${config.port}/api/v1`, description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token obtained from POST /auth/login. Expires in 15 minutes.',
        },
      },
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code:    { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Request validation failed' },
                fields: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field:   { type: 'string' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total:       { type: 'integer', example: 150 },
            page:        { type: 'integer', example: 1 },
            limit:       { type: 'integer', example: 20 },
            totalPages:  { type: 'integer', example: 8 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false },
          },
        },
        UserPublic: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            email:       { type: 'string', format: 'email' },
            fullName:    { type: 'string' },
            role:        { type: 'string', enum: ['VIEWER', 'ANALYST', 'ADMIN'] },
            status:      { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
            lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt:   { type: 'string', format: 'date-time' },
          },
        },
        FinancialRecord: {
          type: 'object',
          properties: {
            id:              { type: 'string', format: 'uuid' },
            amount:          { type: 'string', example: '1500.00' },
            type:            { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
            date:            { type: 'string', format: 'date' },
            description:     { type: 'string', nullable: true },
            referenceNumber: { type: 'string', nullable: true },
            currency:        { type: 'string', example: 'USD' },
            tags:            { type: 'array', items: { type: 'string' } },
            category: {
              type: 'object', nullable: true,
              properties: {
                id:   { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                type: { type: 'string' },
                color: { type: 'string' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',       description: 'Authentication & token management' },
      { name: 'Users',      description: 'User lifecycle & role management (Admin only)' },
      { name: 'Records',    description: 'Financial record CRUD with filtering & search' },
      { name: 'Dashboard',  description: 'Aggregated analytics & summary data' },
      { name: 'Categories', description: 'Transaction category management' },
      { name: 'Audit',      description: 'Immutable audit trail (Admin only)' },
    ],
  },
  apis: ['./src/modules/**/*.router.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
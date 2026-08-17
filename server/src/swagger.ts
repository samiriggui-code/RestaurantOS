import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RestaurantOS API',
      version: '2026-07',
      description:
        'Surface API Express réelle pour La Z Pizza: menu Prisma, commandes online/comptoir, KDS/POS, settings, print jobs et modules optionnels.',
    },
    servers: [{ url: '/api', description: 'API Express' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            success: { type: 'boolean' },
          },
        },
        PublicMenuItem: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            image: { type: 'string' },
          },
        },
        PublicMenuCategory: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            shortLabel: { type: 'string' },
            description: { type: 'string' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/PublicMenuItem' },
            },
          },
        },
        OrderSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderNumber: { type: 'integer' },
            status: {
              type: 'string',
              enum: [
                'PENDING_PAYMENT',
                'PENDING',
                'CONFIRMED',
                'PREPARING',
                'READY',
                'OUT_FOR_DELIVERY',
                'DELIVERY_ISSUE',
                'DELIVERED',
                'COMPLETED',
                'CANCELLED',
              ],
            },
            paymentStatus: {
              type: 'string',
              enum: ['UNPAID', 'PAID', 'REFUNDED'],
            },
            type: {
              type: 'string',
              enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'],
            },
            total: { type: 'integer', description: 'Montant en centimes' },
            customerName: { type: 'string', nullable: true },
            customerPhone: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PrintJob: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', nullable: true },
            type: { type: 'string', enum: ['KITCHEN', 'BAG_LABEL', 'RECEIPT'] },
            status: { type: 'string', enum: ['PENDING', 'PRINTED', 'FAILED'] },
            error: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            printedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
    },
    paths: {
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Connexion staff',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'JWT staff' } },
        },
      },
      '/public/menu': {
        get: {
          tags: ['Public'],
          summary: 'Catalogue public actif',
          parameters: [
            { name: 'businessId', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Catégories menu',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      categories: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/PublicMenuCategory' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/public/hours': {
        get: {
          tags: ['Public'],
          summary: 'Horaires et statut ouvert/fermé',
          responses: { 200: { description: 'Heures ouverture' } },
        },
      },
      '/public/time-slots': {
        get: {
          tags: ['Public'],
          summary: 'Créneaux click & collect',
          responses: { 200: { description: 'Slots disponibles' } },
        },
      },
      '/public/formules': {
        get: {
          tags: ['Public'],
          summary: 'Formules menu',
          responses: { 200: { description: 'Formules configurées' } },
        },
      },
      '/public/delivery/quote': {
        get: {
          tags: ['Public'],
          summary: 'Devis livraison',
          parameters: [
            { name: 'postalCode', in: 'query', schema: { type: 'string' }, required: true },
            { name: 'city', in: 'query', schema: { type: 'string' }, required: true },
            { name: 'pizzaSubtotal', in: 'query', schema: { type: 'number' }, required: true },
          ],
          responses: { 200: { description: 'Quote livraison' } },
        },
      },
      '/public/orders': {
        post: {
          tags: ['Public'],
          summary: 'Créer une commande online',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', description: 'OnlineOrderBody' },
              },
            },
          },
          responses: {
            201: {
              description: 'Commande créée',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      token: { type: 'string' },
                      orderId: { type: 'string' },
                      orderNumber: { type: 'integer' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/public/orders/track-token/{token}': {
        get: {
          tags: ['Public'],
          summary: 'Suivi commande client',
          parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Commande trackée' }, 404: { description: 'Introuvable' } },
        },
      },
      '/menu/categories': {
        get: {
          tags: ['Menu'],
          summary: 'Catalogue complet POS/staff',
          parameters: [{ name: 'businessId', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Catégories + items + modifiers' } },
        },
      },
      '/menu/categories/manage': {
        get: {
          tags: ['Menu'],
          summary: 'Vue CRM de gestion menu',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Catégories staff' } },
        },
      },
      '/orders': {
        get: {
          tags: ['Orders'],
          summary: 'Lister les commandes staff',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'type', in: 'query', schema: { type: 'string' } },
            { name: 'paymentStatus', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'Liste commandes' } },
        },
        post: {
          tags: ['Orders'],
          summary: 'Créer une commande staff/comptoir',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', description: 'Commande comptoir ou staff' },
              },
            },
          },
          responses: { 201: { description: 'Commande créée' } },
        },
      },
      '/orders/{id}/status': {
        patch: {
          tags: ['Orders'],
          summary: 'Changer le statut commande',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string' } },
                },
              },
            },
          },
          responses: { 200: { description: 'Commande mise à jour' } },
        },
      },
      '/orders/{id}/encash': {
        patch: {
          tags: ['Orders'],
          summary: 'Encaisser une commande online au comptoir',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Commande payée' } },
        },
      },
      '/orders/{id}/pos-settle': {
        patch: {
          tags: ['Orders'],
          summary: 'Finaliser une commande POS',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Commande finalisée' } },
        },
      },
      '/orders/{id}/cancel': {
        patch: {
          tags: ['Orders'],
          summary: 'Annuler une commande',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Commande annulée' } },
        },
      },
      '/orders/{id}/print': {
        post: {
          tags: ['Orders'],
          summary: 'Créer un print job pour une commande',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'PrintJob créé' } },
        },
      },
      '/print-jobs': {
        get: {
          tags: ['Print'],
          summary: 'Lister la file d’impression',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Liste print jobs',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/PrintJob' },
                  },
                },
              },
            },
          },
        },
      },
      '/print-jobs/{id}': {
        patch: {
          tags: ['Print'],
          summary: 'ACK impression SUNMI / navigateur',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Statut impression mis à jour' } },
        },
      },
      '/settings': {
        get: {
          tags: ['Settings'],
          summary: 'Lire les réglages business',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Business settings' } },
        },
        put: {
          tags: ['Settings'],
          summary: 'Mettre à jour les réglages business',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Business settings mis à jour' } },
        },
      },
      '/settings/schedule': {
        get: {
          tags: ['Settings'],
          summary: 'Lire horaires, fermetures et time slots',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Planning de service' } },
        },
        put: {
          tags: ['Settings'],
          summary: 'Mettre à jour horaires et time slots',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Planning mis à jour' } },
        },
      },
      '/reservations': {
        get: {
          tags: ['Optional Modules'],
          summary: 'Réservations (module optionnel)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Liste réservations' } },
        },
      },
      '/wifi/qr-codes': {
        get: {
          tags: ['Optional Modules'],
          summary: 'Lister QR WiFi',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'QR WiFi' } },
        },
        post: {
          tags: ['Optional Modules'],
          summary: 'Créer un QR WiFi',
          security: [{ BearerAuth: [] }],
          responses: { 201: { description: 'QR créé' } },
        },
      },
      '/loyalty/program': {
        get: {
          tags: ['Optional Modules'],
          summary: 'Programme fidélité',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Programme fidélité' } },
        },
      },
    },
  },
  apis: [],
}

export const swaggerSpec = swaggerJsdoc(options)

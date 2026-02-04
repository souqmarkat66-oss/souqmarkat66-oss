import { z } from 'zod';
import { insertAdSchema, ads } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  ads: {
    list: {
      method: 'GET' as const,
      path: '/api/ads',
      input: z.object({
        language: z.enum(['ar', 'en']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof ads.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/ads/:id',
      responses: {
        200: z.custom<typeof ads.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/ads',
      input: insertAdSchema,
      responses: {
        201: z.custom<typeof ads.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/ads/:id',
      input: insertAdSchema.partial(),
      responses: {
        200: z.custom<typeof ads.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/ads/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
  ai: {
    generateAdCopy: {
      method: 'POST' as const,
      path: '/api/ai/generate-copy',
      input: z.object({
        productName: z.string(),
        targetAudience: z.string(),
        language: z.enum(['ar', 'en']),
      }),
      responses: {
        200: z.object({
          title: z.string(),
          description: z.string(),
        }),
        500: errorSchemas.internal,
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type AdInput = z.infer<typeof api.ads.create.input>;
export type AdResponse = z.infer<typeof api.ads.create.responses[201]>;

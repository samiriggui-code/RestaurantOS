import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

/**
 * Middleware factory that logs user actions to the audit log.
 * Intercepts res.json to capture the response body and record
 * the action, entity, entityId, and request details in the database.
 */
export function logAction(
  action: string,
  entity: string
): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown): Response {
      try {
        const prisma: PrismaClient = req.app.get('prisma');
        const entityId = req.params?.id || (body as { id?: string })?.id || null;
        const details = JSON.stringify({
          method: req.method,
          path: req.path,
          body: sanitizeBody(req.body),
          statusCode: res.statusCode,
        });
        prisma.auditLog
          .create({
            data: {
              businessId: req.user?.businessId || null,
              userId: req.user?.userId || null,
              action,
              entity,
              entityId,
              details,
              ipAddress: req.ip,
            },
          })
          .catch(() => {});
      } catch {
        // best-effort : un échec du log d'audit ne doit jamais faire échouer la requête
      }
      return originalJson(body);
    };
    next();
  };
}

function sanitizeBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const sanitized = { ...(body as Record<string, unknown>) };
  delete sanitized.password;
  delete sanitized.currentPassword;
  delete sanitized.newPassword;
  delete sanitized.token;
  delete sanitized.refreshToken;
  return sanitized;
}

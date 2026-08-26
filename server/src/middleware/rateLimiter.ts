import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/** Désactivé en dev local — évite « Too many requests » pendant les tests manuels. */
function skipInDev(): boolean {
  return isDev;
}

/** General API rate limiter: 200 requests per 15-minute window */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
});

/**
 * Auth (login / PIN) : 25 tentatives / 15 min par IP.
 * Les succès ne comptent pas (équipe qui se connecte le matin).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInDev,
});

/** Strictest rate limiter for sensitive operations: 20 requests per hour */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
});

/** Order submission rate limiter: 30 requests per minute */
export const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many order requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
});

/** Appel serveur table : max 2 / 30 s par IP (anti-spam bots). */
export const waiterCallLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 2,
  message: { error: 'Trop d’appels serveur. Réessayez dans un instant.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev || isTest,
});

import rateLimit from 'express-rate-limit'

const isDev = process.env.NODE_ENV === 'development'

/** Désactivé en dev local — évite « Too many requests » pendant les tests. */
function skipInDev() {
  return isDev
}

/** General API rate limiter: 200 requests per 15-minute window */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
})

/** Strict rate limiter for auth endpoints: 5 requests per 15-minute window */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: skipInDev,
})

/** Strictest rate limiter for sensitive operations: 20 requests per hour */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
})

/** Order submission rate limiter: 30 requests per minute */
export const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many order requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
})

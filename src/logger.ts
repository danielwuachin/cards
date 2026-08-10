import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * PCI-DSS redaction rules, exported standalone so tests can exercise the
 * exact config in production instead of a hand-copied duplicate.
 */
export const redactConfig = {
  paths: [
    'req.body.pan',
    'req.headers.authorization',
    '*.pan',
    '*.cardNumber',
    '*.creditCard',
    '*.encryptedPan',
    'pan',
    'cardNumber',
    'creditCard',
  ],
  censor: '[REDACTED]',
};

/**
 * Centralized Pino Logger instance configured with PCI-DSS redaction rules.
 * Uses pino-pretty in local development and structured JSON in production.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  redact: redactConfig,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

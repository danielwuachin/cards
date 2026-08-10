import pino from 'pino';
import { redactConfig } from '../../src/logger';

describe('Logger PCI-DSS Redaction (Unit Test)', () => {
  it('should redact sensitive PAN fields from log output', () => {
    let loggedData = '';

    // Stream de captura para inspeccionar la salida JSON de Pino
    const destination = {
      write: (msg: string): void => {
        loggedData += msg;
      },
    };

    const testLogger = pino(
      {
        level: 'info',
        redact: redactConfig,
      },
      destination,
    );

    testLogger.info({ pan: '4532015112830366', holderName: 'DANIEL L3' }, 'Card log test');

    expect(loggedData).toContain('[REDACTED]');
    expect(loggedData).not.toContain('4532015112830366');
    expect(loggedData).toContain('DANIEL L3');
  });

  it('should redact authorization header from HTTP log payload', () => {
    let loggedData = '';

    const destination = {
      write: (msg: string): void => {
        loggedData += msg;
      },
    };

    const testLogger = pino(
      {
        level: 'info',
        redact: redactConfig,
      },
      destination,
    );

    testLogger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer secret_token_123',
          },
        },
      },
      'Auth header test',
    );

    expect(loggedData).toContain('[REDACTED]');
    expect(loggedData).not.toContain('secret_token_123');
  });
});

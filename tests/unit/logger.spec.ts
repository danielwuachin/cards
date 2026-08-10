import pino from 'pino';

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
        redact: {
          paths: ['req.body.pan', 'req.headers.authorization', '*.pan', 'pan'],
          censor: '[REDACTED]',
        },
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
        redact: {
          paths: ['req.headers.authorization'],
          censor: '[REDACTED]',
        },
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

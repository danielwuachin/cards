import request from 'supertest';
import { app } from '../../src/app';

describe('Express API Endpoints & E2E (Supertest)', () => {
  describe('GET /health (Liveness)', () => {
    it('should return 200 OK with status and instanceId', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('instanceId');
    });
  });

  describe('POST /cards (Validations & Errors)', () => {
    it('should return 400 Bad Request when Idempotency-Key header is missing', async () => {
      const response = await request(app).post('/cards').send({
        pan: '4532015112830366',
        expirationMonth: 12,
        expirationYear: 2030,
        holderName: 'DANIEL L3',
      });

      expect(response.status).toBe(400);
      expect(response.body.detail).toBe('Idempotency-Key header is required for this operation');
    });

    it('should return 400 Bad Request in RFC 7807 format when PAN fails Luhn check', async () => {
      const response = await request(app)
        .post('/cards')
        .set('Idempotency-Key', 'e2e-luhn-check')
        .send({
          pan: '4532015112830367', // Luhn inválido
          expirationMonth: 12,
          expirationYear: 2030,
          holderName: 'DANIEL L3',
        });

      expect(response.status).toBe(400);
      expect(response.type).toContain('application/problem+json');
      expect(response.body).toEqual({
        type: 'https://api.cards.local/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'The provided PAN failed the Luhn checksum validation algorithm',
      });
    });

    it('should return 400 Bad Request when expiration date is in the past', async () => {
      const response = await request(app)
        .post('/cards')
        .set('Idempotency-Key', 'e2e-expired-check')
        .send({
          pan: '4532015112830366',
          expirationMonth: 1,
          expirationYear: 2020,
          holderName: 'DANIEL L3',
        });

      expect(response.status).toBe(400);
      expect(response.body.title).toBe('Bad Request');
      expect(response.body.detail).toContain('past');
    });
  });

  describe('GET /cards:search (Validation)', () => {
    it('should return 400 Bad Request if last4 is invalid', async () => {
      const response = await request(app).get('/cards:search?last4=12');

      expect(response.status).toBe(400);
      expect(response.body.detail).toBe('last4 query parameter must be exactly 4 numeric digits');
    });
  });
});

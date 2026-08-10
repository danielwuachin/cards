import {
  createCardService,
  getCardByIdService,
  revealCardPanService,
  listCardsService,
  searchByLast4Service,
} from '../../src/services/card.service';
import { encryptPan } from '../../src/utils/crypto';
import { config } from '../../src/config';

describe('CardService Pure Functions (Unit Tests)', () => {
  const mockDbQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCardService', () => {
    it('should create and encrypt card when given valid input data', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: '018f6f52-4752-7889-a9a3-5c8c50e7b89a',
            encrypted_pan: 'abc123enc',
            iv: '123456789012345678901234',
            auth_tag: '12345678901234567890123456789012',
            last4: '0366',
            expiration_month: 12,
            expiration_year: 2030,
            holder_name: 'John Doe',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await createCardService(
        {
          pan: '4532015112830366',
          expirationMonth: 12,
          expirationYear: 2030,
          holderName: 'John Doe',
        },
        mockDbQuery,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pan).toBe('**** **** **** 0366');
        expect(result.value.holderName).toBe('John Doe');
      }
    });

    it('should return BadRequestError when Luhn checksum fails', async () => {
      const result = await createCardService(
        {
          pan: '4532015112830367', // Failed Luhn
          expirationMonth: 12,
          expirationYear: 2030,
          holderName: 'John Doe',
        },
        mockDbQuery,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.status).toBe(400);
      }
    });
  });

  describe('revealCardPanService', () => {
    it('should decrypt and reveal cleartext PAN', async () => {
      const cardId = '018f6f52-4752-7889-a9a3-5c8c50e7b89a';
      const rawPan = '4532015112830366';
      const encRes = encryptPan(rawPan, cardId, config.security.cardEncryptionKey);

      expect(encRes.ok).toBe(true);
      if (!encRes.ok) return;

      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: cardId,
            encrypted_pan: encRes.value.encryptedPan,
            iv: encRes.value.iv,
            auth_tag: encRes.value.authTag,
            last4: '0366',
            expiration_month: 12,
            expiration_year: 2030,
            holder_name: 'John Doe',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const revealRes = await revealCardPanService(cardId, mockDbQuery);

      expect(revealRes.ok).toBe(true);
      if (revealRes.ok) {
        expect(revealRes.value.pan).toBe(rawPan);
        expect(revealRes.value.holderName).toBe('John Doe');
      }
    });
  });

  describe('getCardByIdService', () => {
    it('should return card with masked PAN for valid UUID', async () => {
      const cardId = '018f6f52-4752-7889-a9a3-5c8c50e7b89a';
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: cardId,
            encrypted_pan: 'abc',
            iv: 'def',
            auth_tag: 'ghi',
            last4: '0366',
            expiration_month: 12,
            expiration_year: 2030,
            holder_name: 'John Doe',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await getCardByIdService(cardId, mockDbQuery);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pan).toBe('**** **** **** 0366');
      }
    });
  });

  describe('listCardsService', () => {
    it('should list cards with cursor pagination metadata', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: '018f6f52-4752-7889-a9a3-5c8c50e7b89a',
            encrypted_pan: 'abc',
            iv: 'def',
            auth_tag: 'ghi',
            last4: '0366',
            expiration_month: 12,
            expiration_year: 2030,
            holder_name: 'John Doe',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await listCardsService({ limit: 10 }, mockDbQuery);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(1);
        expect(result.value.pagination.hasMore).toBe(false);
      }
    });
  });

  describe('searchByLast4Service', () => {
    it('should return cards matching requested last4', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: '018f6f52-4752-7889-a9a3-5c8c50e7b89a',
            encrypted_pan: 'abc',
            iv: 'def',
            auth_tag: 'ghi',
            last4: '0366',
            expiration_month: 12,
            expiration_year: 2030,
            holder_name: 'John Doe',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await searchByLast4Service('0366', mockDbQuery);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].pan).toBe('**** **** **** 0366');
      }
    });
  });
});

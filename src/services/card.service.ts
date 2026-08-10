import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { Result, ok, err } from '../shared/result';
import { BadRequestError, NotFoundError, AppError, ERROR_MESSAGES } from '../shared/errors';
import { validateLuhn, validateExpiration } from '../utils/luhn';
import { encryptPan, decryptPan, maskPan } from '../utils/crypto';
import { encodeCursor, decodeCursor } from '../utils/cursor';
import { query as defaultQuery } from '../db';
import { config } from '../config';

// -----------------------------------------------------------------------------
// Zod Validation Schemas
// -----------------------------------------------------------------------------
export const CreateCardSchema = z.preprocess(
  (val: unknown) => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        expirationMonth: obj.expirationMonth ?? obj.expMonth,
        expirationYear: obj.expirationYear ?? obj.expYear,
      };
    }
    return val;
  },
  z.object({
    pan: z
      .string()
      .transform((val) => val.replace(/\s+/g, ''))
      .refine((val) => /^\d{13,19}$/.test(val), {
        message: 'PAN must be a numeric string between 13 and 19 digits',
      }),
    expirationMonth: z.number().int().min(1).max(12),
    expirationYear: z.number().int().min(2000).max(2100),
    holderName: z.string().trim().min(1, { message: 'Holder name cannot be empty' }).max(100),
  }),
);

export type CreateCardInput = z.infer<typeof CreateCardSchema>;

export const ListCardsQuerySchema = z.object({
  limit: z
    .preprocess((val) => (val ? parseInt(String(val), 10) : 10), z.number().int().min(1).max(100))
    .default(10),
  cursor: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type ListCardsQueryInput = z.infer<typeof ListCardsQuerySchema>;

// -----------------------------------------------------------------------------
// DTO Interfaces
// -----------------------------------------------------------------------------
export interface CardResponse {
  readonly id: string;
  readonly pan: string;
  readonly expirationMonth: number;
  readonly expirationYear: number;
  readonly holderName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListCardsResponse {
  readonly data: CardResponse[];
  readonly pagination: {
    readonly limit: number;
    readonly nextCursor: string | null;
    readonly prevCursor: string | null;
    readonly hasMore: boolean;
  };
}

export interface CardRow {
  id: string;
  encrypted_pan: string;
  iv: string;
  auth_tag: string;
  last4: string;
  expiration_month: number;
  expiration_year: number;
  holder_name: string;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
}

function toIsoString(val: unknown): string {
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function mapRowToResponse(row: CardRow): CardResponse {
  return {
    id: row.id,
    pan: maskPan(row.last4),
    expirationMonth: row.expiration_month,
    expirationYear: row.expiration_year,
    holderName: row.holder_name,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// -----------------------------------------------------------------------------
// Pure Service Functions (FP)
// -----------------------------------------------------------------------------

/**
 * Creates and encrypts a new card record in PostgreSQL.
 */
export async function createCardService(
  rawInput: unknown,
  dbQuery = defaultQuery,
): Promise<Result<CardResponse, AppError>> {
  const parseResult = CreateCardSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues[0]?.message || 'Invalid input data';
    return err(new BadRequestError(errorMsg));
  }

  const input = parseResult.data;

  if (!validateLuhn(input.pan)) {
    return err(new BadRequestError(ERROR_MESSAGES.INVALID_PAN));
  }

  const expResult = validateExpiration(input.expirationMonth, input.expirationYear);
  if (expResult.ok === false) {
    return err(expResult.error);
  }

  const cardId = uuidv7();

  const encResult = encryptPan(input.pan, cardId, config.security.cardEncryptionKey);
  if (encResult.ok === false) {
    return err(encResult.error);
  }

  const encData = encResult.value;

  const sql = `
    INSERT INTO cards (
      id, encrypted_pan, iv, auth_tag, last4, expiration_month, expiration_year, holder_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const values = [
    cardId,
    encData.encryptedPan,
    encData.iv,
    encData.authTag,
    encData.last4,
    input.expirationMonth,
    input.expirationYear,
    input.holderName,
  ];

  const dbResult = await dbQuery<CardRow>(sql, values);
  const cardRow = dbResult.rows[0];

  return ok(mapRowToResponse(cardRow));
}

/**
 * Retrieves a card record by UUIDv7 ID and returns masked PAN.
 */
export async function getCardByIdService(
  id: string,
  dbQuery = defaultQuery,
): Promise<Result<CardResponse, AppError>> {
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return err(new BadRequestError('Invalid UUID format'));
  }

  const sql = `SELECT * FROM cards WHERE id = $1`;
  const dbResult = await dbQuery<CardRow>(sql, [id]);

  if (dbResult.rows.length === 0) {
    return err(new NotFoundError(ERROR_MESSAGES.CARD_NOT_FOUND));
  }

  return ok(mapRowToResponse(dbResult.rows[0]));
}

/**
 * Reveals cleartext PAN by executing AES-256-GCM decryption for authorized verification.
 */
export async function revealCardPanService(
  id: string,
  dbQuery = defaultQuery,
): Promise<Result<{ id: string; pan: string; holderName: string }, AppError>> {
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return err(new BadRequestError('Invalid UUID format'));
  }

  const sql = `SELECT * FROM cards WHERE id = $1`;
  const dbResult = await dbQuery<CardRow>(sql, [id]);

  if (dbResult.rows.length === 0) {
    return err(new NotFoundError(ERROR_MESSAGES.CARD_NOT_FOUND));
  }

  const row = dbResult.rows[0];

  const decryptRes = decryptPan(
    row.encrypted_pan,
    row.iv,
    row.auth_tag,
    row.id,
    config.security.cardEncryptionKey,
  );

  if (decryptRes.ok === false) {
    return err(decryptRes.error);
  }

  return ok({
    id: row.id,
    pan: decryptRes.value,
    holderName: row.holder_name,
  });
}

/**
 * Lists card records using opaque Base64 cursor pagination over UUIDv7.
 */
export async function listCardsService(
  rawQuery: unknown,
  dbQuery = defaultQuery,
): Promise<Result<ListCardsResponse, AppError>> {
  const parseResult = ListCardsQuerySchema.safeParse(rawQuery);
  if (!parseResult.success) {
    return err(new BadRequestError('Invalid query parameters for pagination'));
  }

  const { limit, cursor, order } = parseResult.data;

  let cursorId: string | null = null;

  if (cursor) {
    const decodedRes = decodeCursor(cursor);
    if (decodedRes.ok === false) {
      return err(decodedRes.error);
    }
    cursorId = decodedRes.value.id;
  }

  const fetchLimit = limit + 1;
  const sqlParams: unknown[] = [];
  let sql = `SELECT * FROM cards`;

  if (cursorId) {
    const operator = order === 'desc' ? '<' : '>';
    sql += ` WHERE id ${operator} $1 ORDER BY id ${order.toUpperCase()} LIMIT $2`;
    sqlParams.push(cursorId, fetchLimit);
  } else {
    sql += ` ORDER BY id ${order.toUpperCase()} LIMIT $1`;
    sqlParams.push(fetchLimit);
  }

  const dbResult = await dbQuery<CardRow>(sql, sqlParams);
  const rows = dbResult.rows;

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const data = pageRows.map(mapRowToResponse);

  const nextCursor =
    hasMore && pageRows.length > 0
      ? encodeCursor({ id: pageRows[pageRows.length - 1].id })
      : null;

  const prevCursor = cursor ? cursor : null;

  return ok({
    data,
    pagination: {
      limit,
      nextCursor,
      prevCursor,
      hasMore,
    },
  });
}

/**
 * Searches card records by last 4 digits.
 */
export async function searchByLast4Service(
  last4: unknown,
  dbQuery = defaultQuery,
): Promise<Result<CardResponse[], AppError>> {
  if (typeof last4 !== 'string' || !/^\d{4}$/.test(last4)) {
    return err(new BadRequestError(ERROR_MESSAGES.INVALID_LAST4));
  }

  const sql = `SELECT * FROM cards WHERE last4 = $1 ORDER BY id DESC`;
  const dbResult = await dbQuery<CardRow>(sql, [last4]);

  const cards = dbResult.rows.map(mapRowToResponse);
  return ok(cards);
}

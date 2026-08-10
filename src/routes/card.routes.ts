import { Router } from 'express';
import {
  createCardHandler,
  getCardByIdHandler,
  revealCardPanHandler,
  listCardsHandler,
  searchByLast4Handler,
} from '../controllers/card.controller';
import { idempotencyMiddleware } from '../middleware/idempotency';
import { searchRateLimiter } from '../middleware/rateLimiter';

export const cardRouter = Router();

// POST /cards -> Creates card (with atomic idempotency)
cardRouter.post('/cards', idempotencyMiddleware, createCardHandler);

// GET /cards:search?last4= and /cards/search?last4= -> Search by last 4 digits (with rate limiter)
cardRouter.get('/cards\\:search', searchRateLimiter, searchByLast4Handler);
cardRouter.get('/cards/search', searchRateLimiter, searchByLast4Handler);

// GET /cards/:id/reveal -> Decrypts and reveals cleartext PAN for verification
cardRouter.get('/cards/:id/reveal', revealCardPanHandler);

// GET /cards?limit=&cursor= -> Lists cards with UUIDv7 opaque Base64 cursor pagination
cardRouter.get('/cards', listCardsHandler);

// GET /cards/:id -> Gets card by UUIDv7 ID (masked PAN)
cardRouter.get('/cards/:id', (req, res, next) => {
  if (req.params.id === ':search' || req.params.id === 'search') {
    return searchByLast4Handler(req, res, next);
  }
  return getCardByIdHandler(req, res, next);
});

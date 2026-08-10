import { Router } from 'express';
import {
  createCardHandler,
  getCardByIdHandler,
  listCardsHandler,
  searchByLast4Handler,
} from '../controllers/card.controller';
import { idempotencyMiddleware } from '../middleware/idempotency';

export const cardRouter = Router();

// POST /cards -> Creates card (with atomic idempotency)
cardRouter.post('/cards', idempotencyMiddleware, createCardHandler);

// GET /cards:search?last4= and /cards/search?last4= -> Search by last 4 digits
cardRouter.get('/cards\\:search', searchByLast4Handler);
cardRouter.get('/cards/search', searchByLast4Handler);

// GET /cards?limit=&cursor= -> Lists cards with UUIDv7 opaque Base64 cursor pagination
cardRouter.get('/cards', listCardsHandler);

// GET /cards/:id -> Gets card by UUIDv7 ID (masked PAN)
cardRouter.get('/cards/:id', (req, res, next) => {
  if (req.params.id === ':search' || req.params.id === 'search') {
    return searchByLast4Handler(req, res, next);
  }
  return getCardByIdHandler(req, res, next);
});

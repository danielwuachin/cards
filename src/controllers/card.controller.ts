import { Request, Response, NextFunction } from 'express';
import {
  createCardService,
  getCardByIdService,
  listCardsService,
  searchByLast4Service,
} from '../services/card.service';

/**
 * Handles POST /cards request.
 */
export async function createCardHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await createCardService(req.body);

    if (result.ok === false) {
      return next(result.error);
    }

    res.status(201).json(result.value);
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /cards/:id request.
 */
export async function getCardByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getCardByIdService(req.params.id);

    if (result.ok === false) {
      return next(result.error);
    }

    res.status(200).json(result.value);
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /cards cursor pagination request.
 */
export async function listCardsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await listCardsService(req.query);

    if (result.ok === false) {
      return next(result.error);
    }

    res.status(200).json(result.value);
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /cards:search?last4= request.
 */
export async function searchByLast4Handler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const last4 = req.query.last4;
    const result = await searchByLast4Service(last4);

    if (result.ok === false) {
      return next(result.error);
    }

    res.status(200).json(result.value);
  } catch (err) {
    next(err);
  }
}

import { Router } from 'express';
import {
  healthLivenessHandler,
  healthReadinessHandler,
} from '../controllers/health.controller';

export const healthRouter = Router();

healthRouter.get('/health', healthLivenessHandler);
healthRouter.get('/health/ready', healthReadinessHandler);

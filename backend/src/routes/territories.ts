import { Router } from 'express';
import {
  getTerritories,
  getStats,
  getTerritoryById,
  getTerritoryHistory,
  getUserTerritories,
} from '../controllers/territoryController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Public routes (map data visible to everyone)
router.get('/', getTerritories);
router.get('/stats', getStats);
router.get('/:id', getTerritoryById);
router.get('/:id/history', getTerritoryHistory);

// Authenticated routes
router.get('/user/:userId', requireAuth, getUserTerritories);

export default router;

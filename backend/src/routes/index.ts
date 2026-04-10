import { Router } from 'express';
import authRoutes from './auth';
import activityRoutes from './activities';
import territoryRoutes from './territories';
import socialRoutes from './social';

const router = Router();

router.use('/auth', authRoutes);
router.use('/activities', activityRoutes);
router.use('/territories', territoryRoutes);
router.use('/social', socialRoutes);

router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

export default router;

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  syncActivity,
  syncLatestActivity,
  listActivities,
  stravaWebhook,
} from '../controllers/activityController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Max 5 syncs per user per 10 minutes
const syncRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req as typeof req & { user?: { userId: string } }).user?.userId ?? req.ip ?? 'unknown',
  message: { error: 'Demasiadas sincronizaciones. Espera unos minutos antes de volver a intentarlo.' },
});

// Strava webhook (no auth — Strava calls this directly)
router.get('/webhook', stravaWebhook);
router.post('/webhook', stravaWebhook);

// Authenticated routes
router.use(requireAuth);

router.get('/', listActivities);
router.post('/sync-latest', syncRateLimit, syncLatestActivity);
router.post('/sync/:stravaActivityId', syncRateLimit, syncActivity);

export default router;

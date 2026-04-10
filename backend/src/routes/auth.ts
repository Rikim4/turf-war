import { Router } from 'express';
import { stravaOAuthRedirect, stravaCallback, getMe, updateProfile, changeTeam, getPublicProfile } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Initiate Strava OAuth flow: GET /api/auth/strava?team=blue|red|yellow
router.get('/strava', stravaOAuthRedirect);

// OAuth callback from Strava: GET /api/auth/strava/callback
router.get('/strava/callback', stravaCallback);

// Get authenticated user's profile: GET /api/auth/me
router.get('/me', requireAuth, getMe);

// Update profile: PUT /api/auth/profile
router.put('/profile', requireAuth, updateProfile);

// Change team (locked 14 days): POST /api/auth/change-team
router.post('/change-team', requireAuth, changeTeam);

// Public profile: GET /api/auth/users/:userId
router.get('/users/:userId', getPublicProfile);

export default router;

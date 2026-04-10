import { Router } from 'express';
import { searchUsers, followUser, unfollowUser, getFollowers, getFollowing, getFollowCounts } from '../controllers/socialController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Search — requires auth to show is_following state
router.get('/search', requireAuth, searchUsers);

// Follow / unfollow
router.post('/follow/:userId',   requireAuth, followUser);
router.delete('/follow/:userId', requireAuth, unfollowUser);

// Followers / following lists (public)
router.get('/:userId/followers', requireAuth, getFollowers);
router.get('/:userId/following', requireAuth, getFollowing);
router.get('/:userId/counts',    getFollowCounts);

export default router;

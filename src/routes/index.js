/**
 * API Routes - Complete Recommendation Service
 */

import { Router } from 'express';
import * as recommendationController from '../controllers/recommendationController.js';
import * as eventController from '../controllers/eventController.js';
import * as syncController from '../controllers/syncController.js';

const router = Router();

// ============================================
// RECOMMENDATION ROUTES
// ============================================

// Get personalized elections for user
// GET /api/recommendations/elections?userId=123&limit=10&offset=0
router.get('/recommendations/elections', recommendationController.getElectionsForYou);

// Get similar elections
// GET /api/recommendations/similar/41?limit=5
router.get('/recommendations/similar/:electionId', recommendationController.getSimilarElections);

// Get trending elections
// GET /api/recommendations/trending?limit=10&timeWindow=7
router.get('/recommendations/trending', recommendationController.getTrendingElections);

// Get popular elections
// GET /api/recommendations/popular?limit=10
router.get('/recommendations/popular', recommendationController.getPopularElections);

// Get lotterized elections (with lottery prizes)
// GET /api/recommendations/lotterized?limit=10&minPrize=1000
router.get('/recommendations/lotterized', recommendationController.getLotterizedPicks);

// Get elections by category
// GET /api/recommendations/by-category?categoryId=2&limit=10
router.get('/recommendations/by-category', recommendationController.getElectionsByCategory);

// Get target audience for an election
// GET /api/recommendations/audience/41?limit=10
router.get('/recommendations/audience/:electionId', recommendationController.getAudienceForElection);

// Health check for recommendation engine
// GET /api/recommendations/health
router.get('/recommendations/health', recommendationController.checkHealth);

// ============================================
// EVENT TRACKING ROUTES
// ============================================

router.post('/events/track', eventController.trackEvent);
router.post('/events/vote', eventController.trackVote);
router.post('/events/view', eventController.trackView);
router.post('/events/share', eventController.trackShare);
router.post('/events/lottery-win', eventController.trackLotteryWin);
router.post('/events/election-created', eventController.trackElectionCreated);
router.post('/events/batch', eventController.batchTrackEvents);
router.get('/events/buffer-status', eventController.getBufferStatus);
router.post('/events/flush', eventController.flushBuffer);

// ============================================
// SYNC ROUTES
// ============================================

// User sync
router.post('/sync/users', syncController.syncUsers);
router.post('/sync/users/:userId', syncController.syncSingleUser);

// Election sync
router.post('/sync/elections', syncController.syncElections);
router.post('/sync/elections/:electionId', syncController.syncSingleElection);

// Vote sync
router.post('/sync/votes', syncController.syncVotes);
router.get('/sync/vote-counts', syncController.getVoteCounts);

// Full sync (includes users, elections, votes)
router.post('/sync/full', syncController.runFullSync);

// Status
router.get('/sync/status', syncController.getSyncStatus);

export default router;
// /**
//  * API Routes
//  */

// import { Router } from 'express';
// import * as recommendationController from '../controllers/recommendationController.js';
// import * as eventController from '../controllers/eventController.js';
// import * as syncController from '../controllers/syncController.js';

// const router = Router();

// // ============================================
// // RECOMMENDATION ROUTES
// // ============================================
// router.get('/recommendations/elections', recommendationController.getElectionsForYou);
// router.get('/recommendations/similar/:electionId', recommendationController.getSimilarElections);
// router.get('/recommendations/trending', recommendationController.getTrendingElections);
// router.get('/recommendations/lotterized', recommendationController.getLotterizedPicks);
// router.get('/recommendations/by-category', recommendationController.getElectionsByCategory);
// router.get('/recommendations/audience/:electionId', recommendationController.getAudienceForElection);

// // ============================================
// // EVENT TRACKING ROUTES
// // ============================================
// router.post('/events/track', eventController.trackEvent);
// router.post('/events/vote', eventController.trackVote);
// router.post('/events/view', eventController.trackView);
// router.post('/events/share', eventController.trackShare);
// router.post('/events/lottery-win', eventController.trackLotteryWin);
// router.post('/events/election-created', eventController.trackElectionCreated);
// router.post('/events/batch', eventController.batchTrackEvents);
// router.get('/events/buffer-status', eventController.getBufferStatus);
// router.post('/events/flush', eventController.flushBuffer);

// // ============================================
// // SYNC ROUTES
// // ============================================
// // User sync
// router.post('/sync/users', syncController.syncUsers);
// router.post('/sync/users/:userId', syncController.syncSingleUser);

// // Election sync
// router.post('/sync/elections', syncController.syncElections);
// router.post('/sync/elections/:electionId', syncController.syncSingleElection);

// // Vote sync (NEW)
// router.post('/sync/votes', syncController.syncVotes);
// router.get('/sync/vote-counts', syncController.getVoteCounts);

// // Full sync (includes users, elections, votes)
// router.post('/sync/full', syncController.runFullSync);

// // Status
// router.get('/sync/status', syncController.getSyncStatus);

// export default router;
// /**
//  * API Routes
//  */

// import { Router } from 'express';
// import * as recommendationController from '../controllers/recommendationController.js';
// import * as eventController from '../controllers/eventController.js';
// import * as syncController from '../controllers/syncController.js';

// const router = Router();

// // Recommendation Routes
// router.get('/recommendations/elections', recommendationController.getElectionsForYou);
// router.get('/recommendations/similar/:electionId', recommendationController.getSimilarElections);
// router.get('/recommendations/trending', recommendationController.getTrendingElections);
// router.get('/recommendations/lotterized', recommendationController.getLotterizedPicks);
// router.get('/recommendations/by-category', recommendationController.getElectionsByCategory);
// router.get('/recommendations/audience/:electionId', recommendationController.getAudienceForElection);

// // Event Tracking Routes
// router.post('/events/track', eventController.trackEvent);
// router.post('/events/vote', eventController.trackVote);
// router.post('/events/view', eventController.trackView);
// router.post('/events/share', eventController.trackShare);
// router.post('/events/lottery-win', eventController.trackLotteryWin);
// router.post('/events/election-created', eventController.trackElectionCreated);
// router.post('/events/batch', eventController.batchTrackEvents);
// router.get('/events/buffer-status', eventController.getBufferStatus);
// router.post('/events/flush', eventController.flushBuffer);

// // Sync Routes
// router.post('/sync/users', syncController.syncUsers);
// router.post('/sync/users/:userId', syncController.syncSingleUser);
// router.post('/sync/elections', syncController.syncElections);
// router.post('/sync/elections/:electionId', syncController.syncSingleElection);
// router.post('/sync/full', syncController.runFullSync);
// router.get('/sync/status', syncController.getSyncStatus);

// export default router;
// /**
//  * API Routes
//  */

// import { Router } from 'express';
// // import * as recommendationController from '../controllers/recommendationController.js';
// // import * as eventController from '../controllers/eventController.js';
// // import * as syncController from '../controllers/syncController.js';

// const router = Router();

// // Recommendation Routes
// router.get('/recommendations/elections', recommendationController.getElectionsForYou);
// router.get('/recommendations/similar/:electionId', recommendationController.getSimilarElections);
// router.get('/recommendations/trending', recommendationController.getTrendingElections);
// router.get('/recommendations/lotterized', recommendationController.getLotterizedPicks);
// router.get('/recommendations/by-category', recommendationController.getElectionsByCategory);
// router.get('/recommendations/audience/:electionId', recommendationController.getAudienceForElection);

// // Event Tracking Routes
// router.post('/events/track', eventController.trackEvent);
// router.post('/events/vote', eventController.trackVote);
// router.post('/events/view', eventController.trackView);
// router.post('/events/share', eventController.trackShare);
// router.post('/events/lottery-win', eventController.trackLotteryWin);
// router.post('/events/election-created', eventController.trackElectionCreated);
// router.post('/events/batch', eventController.batchTrackEvents);
// router.get('/events/buffer-status', eventController.getBufferStatus);
// router.post('/events/flush', eventController.flushBuffer);

// // Sync Routes
// router.post('/sync/users', syncController.syncUsers);
// router.post('/sync/users/:userId', syncController.syncSingleUser);
// router.post('/sync/elections', syncController.syncElections);
// router.post('/sync/elections/:electionId', syncController.syncSingleElection);
// router.post('/sync/full', syncController.runFullSync);
// router.get('/sync/status', syncController.getSyncStatus);

// export default router;
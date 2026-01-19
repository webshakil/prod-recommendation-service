/**
 * Recommendation Controller
 * Handles API endpoints for election recommendations
 */

import * as recommendations from '../services/shaped/recommendations.js';
import logger from '../utils/logger.js';

/**
 * GET /api/recommendations/elections
 * Get personalized election recommendations for a user
 */
export const getElectionsForYou = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id || 'anonymous';
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    logger.info({ userId, limit, offset }, 'API: getElectionsForYou');

    const result = await recommendations.getElectionsForYou(userId, { limit, offset });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getElectionsForYou');
    res.status(500).json({ success: false, error: 'Failed to get recommendations' });
  }
};

/**
 * GET /api/recommendations/similar/:electionId
 * Get elections similar to a given election
 */
export const getSimilarElections = async (req, res) => {
  try {
    const { electionId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    if (!electionId) {
      return res.status(400).json({ success: false, error: 'electionId is required' });
    }

    logger.info({ electionId, limit }, 'API: getSimilarElections');

    const result = await recommendations.getSimilarElections(electionId, { limit });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getSimilarElections');
    res.status(500).json({ success: false, error: 'Failed to get similar elections' });
  }
};

/**
 * GET /api/recommendations/trending
 * Get trending elections
 */
export const getTrendingElections = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const timeWindow = parseInt(req.query.timeWindow) || 7;

    logger.info({ limit, timeWindow }, 'API: getTrendingElections');

    const result = await recommendations.getTrendingElections({ limit, timeWindow });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getTrendingElections');
    res.status(500).json({ success: false, error: 'Failed to get trending elections' });
  }
};

/**
 * GET /api/recommendations/popular
 * Get popular elections
 */
export const getPopularElections = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    logger.info({ limit }, 'API: getPopularElections');

    const result = await recommendations.getPopularElections({ limit });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getPopularElections');
    res.status(500).json({ success: false, error: 'Failed to get popular elections' });
  }
};

/**
 * GET /api/recommendations/lotterized
 * Get lotterized elections (with lottery prizes)
 */
export const getLotterizedPicks = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const minPrize = parseFloat(req.query.minPrize) || 0;

    logger.info({ limit, minPrize }, 'API: getLotterizedPicks');

    const result = await recommendations.getLotterizedPicks({ limit, minPrize });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getLotterizedPicks');
    res.status(500).json({ success: false, error: 'Failed to get lotterized elections' });
  }
};

/**
 * GET /api/recommendations/by-category
 * Get elections by category
 */
export const getElectionsByCategory = async (req, res) => {
  try {
    const categoryId = parseInt(req.query.categoryId);
    const limit = parseInt(req.query.limit) || 10;

    if (!categoryId) {
      return res.status(400).json({ success: false, error: 'categoryId is required' });
    }

    logger.info({ categoryId, limit }, 'API: getElectionsByCategory');

    const result = await recommendations.getElectionsByCategory(categoryId, { limit });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getElectionsByCategory');
    res.status(500).json({ success: false, error: 'Failed to get elections by category' });
  }
};

/**
 * GET /api/recommendations/audience/:electionId
 * Get target audience for an election
 */
export const getAudienceForElection = async (req, res) => {
  try {
    const { electionId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    if (!electionId) {
      return res.status(400).json({ success: false, error: 'electionId is required' });
    }

    logger.info({ electionId, limit }, 'API: getAudienceForElection');

    const result = await recommendations.getAudienceForElection(electionId, { limit });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getAudienceForElection');
    res.status(500).json({ success: false, error: 'Failed to get audience' });
  }
};

/**
 * GET /api/recommendations/health
 * Check recommendation engine health
 */
export const checkHealth = async (req, res) => {
  try {
    const health = await recommendations.checkEngineHealth();
    
    const statusCode = health.healthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: checkHealth');
    res.status(503).json({ healthy: false, error: error.message });
  }
};

export default {
  getElectionsForYou,
  getSimilarElections,
  getTrendingElections,
  getPopularElections,
  getLotterizedPicks,
  getElectionsByCategory,
  getAudienceForElection,
  checkHealth,
};
// /**
//  * Recommendation Controller
//  */

// import * as shaped from '../services/shaped/index.js';
// import logger from '../utils/logger.js';

// export const getElectionsForYou = async (req, res) => {
//   try {
//     const userId = req.query.userId || req.user?.id;
    
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }

//     const limit = parseInt(req.query.limit, 10) || 20;
//     const filters = {
//       category: req.query.category,
//       isLotterized: req.query.isLotterized === 'true' ? true : req.query.isLotterized === 'false' ? false : undefined,
//       maxFee: req.query.maxFee ? parseFloat(req.query.maxFee) : undefined,
//       votingType: req.query.votingType,
//     };

//     const result = await shaped.getElectionsForYou({ userId, limit, filters });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getElectionsForYou');
//     res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
//   }
// };

// export const getSimilarElections = async (req, res) => {
//   try {
//     const { electionId } = req.params;
    
//     if (!electionId) {
//       return res.status(400).json({ success: false, error: 'electionId is required' });
//     }

//     const limit = parseInt(req.query.limit, 10) || 10;
//     const result = await shaped.getSimilarElections({ electionId, limit });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getSimilarElections');
//     res.status(500).json({ success: false, error: 'Failed to fetch similar elections' });
//   }
// };

// export const getTrendingElections = async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 20;
//     const region = req.query.region ? parseInt(req.query.region, 10) : null;

//     const result = await shaped.getTrendingElections({ limit, region });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getTrendingElections');
//     res.status(500).json({ success: false, error: 'Failed to fetch trending elections' });
//   }
// };

// export const getLotterizedPicks = async (req, res) => {
//   try {
//     const userId = req.query.userId || req.user?.id;
    
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }

//     const limit = parseInt(req.query.limit, 10) || 10;
//     const result = await shaped.getLotterizedPicks({ userId, limit });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getLotterizedPicks');
//     res.status(500).json({ success: false, error: 'Failed to fetch lotterized picks' });
//   }
// };

// export const getElectionsByCategory = async (req, res) => {
//   try {
//     const userId = req.query.userId || req.user?.id;
    
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }

//     const rowLimit = parseInt(req.query.rowLimit, 10) || 5;
//     const colLimit = parseInt(req.query.colLimit, 10) || 10;

//     const result = await shaped.getElectionsByCategory({ userId, rowLimit, colLimit });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getElectionsByCategory');
//     res.status(500).json({ success: false, error: 'Failed to fetch elections by category' });
//   }
// };

// export const getAudienceForElection = async (req, res) => {
//   try {
//     const { electionId } = req.params;
    
//     if (!electionId) {
//       return res.status(400).json({ success: false, error: 'electionId is required' });
//     }

//     const limit = parseInt(req.query.limit, 10) || 100;
//     const result = await shaped.getAudienceForElection({ electionId, limit });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getAudienceForElection');
//     res.status(500).json({ success: false, error: 'Failed to fetch audience for election' });
//   }
// };

// export default {
//   getElectionsForYou, getSimilarElections, getTrendingElections,
//   getLotterizedPicks, getElectionsByCategory, getAudienceForElection,
// };
// /**
//  * Recommendation Controller
//  */

// import * as shaped from '../services/shaped/shaped.js';
// import logger from '../utils/logger.js';

// export const getElectionsForYou = async (req, res) => {
//   try {
//     const userId = req.query.userId || req.user?.id;
    
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }

//     const limit = parseInt(req.query.limit, 10) || 20;
//     const filters = {
//       category: req.query.category,
//       isLotterized: req.query.isLotterized === 'true' ? true : req.query.isLotterized === 'false' ? false : undefined,
//       maxFee: req.query.maxFee ? parseFloat(req.query.maxFee) : undefined,
//       votingType: req.query.votingType,
//     };

//     const result = await shaped.getElectionsForYou({ userId, limit, filters });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getElectionsForYou');
//     res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
//   }
// };

// export const getSimilarElections = async (req, res) => {
//   try {
//     const { electionId } = req.params;
    
//     if (!electionId) {
//       return res.status(400).json({ success: false, error: 'electionId is required' });
//     }

//     const limit = parseInt(req.query.limit, 10) || 10;
//     const result = await shaped.getSimilarElections({ electionId, limit });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getSimilarElections');
//     res.status(500).json({ success: false, error: 'Failed to fetch similar elections' });
//   }
// };

// export const getTrendingElections = async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 20;
//     const region = req.query.region ? parseInt(req.query.region, 10) : null;

//     const result = await shaped.getTrendingElections({ limit, region });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getTrendingElections');
//     res.status(500).json({ success: false, error: 'Failed to fetch trending elections' });
//   }
// };

// export const getLotterizedPicks = async (req, res) => {
//   try {
//     const userId = req.query.userId || req.user?.id;
    
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }

//     const limit = parseInt(req.query.limit, 10) || 10;
//     const result = await shaped.getLotterizedPicks({ userId, limit });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getLotterizedPicks');
//     res.status(500).json({ success: false, error: 'Failed to fetch lotterized picks' });
//   }
// };

// export const getElectionsByCategory = async (req, res) => {
//   try {
//     const userId = req.query.userId || req.user?.id;
    
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }

//     const rowLimit = parseInt(req.query.rowLimit, 10) || 5;
//     const colLimit = parseInt(req.query.colLimit, 10) || 10;

//     const result = await shaped.getElectionsByCategory({ userId, rowLimit, colLimit });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getElectionsByCategory');
//     res.status(500).json({ success: false, error: 'Failed to fetch elections by category' });
//   }
// };

// export const getAudienceForElection = async (req, res) => {
//   try {
//     const { electionId } = req.params;
    
//     if (!electionId) {
//       return res.status(400).json({ success: false, error: 'electionId is required' });
//     }

//     const limit = parseInt(req.query.limit, 10) || 100;
//     const result = await shaped.getAudienceForElection({ electionId, limit });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getAudienceForElection');
//     res.status(500).json({ success: false, error: 'Failed to fetch audience for election' });
//   }
// };

// export default {
//   getElectionsForYou, getSimilarElections, getTrendingElections,
//   getLotterizedPicks, getElectionsByCategory, getAudienceForElection,
// };
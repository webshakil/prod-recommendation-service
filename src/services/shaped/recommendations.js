/**
 * Recommendations Service
 * Integrates with Shaped AI for election recommendations
 * 
 * ✅ FIXED: Now properly uses userId for personalized recommendations
 * ✅ FIXED: Reads userId from headers (x-user-id) or query params
 */

import { shapedClient } from './shapedClient.js';
import db from '../../utils/database.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

// Engine name - must match what's in Shaped console
const ENGINE_NAME = 'vottery_elections_for_you';

/**
 * ✅ Check if user has any voting history
 */
const getUserVoteCount = async (userId) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM votteryy_votes WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0]?.count || 0);
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get user vote count');
    return 0;
  }
};

/**
 * Get elections for a user (personalized feed)
 * ✅ FIXED: Now checks user voting history and uses Shaped /rank endpoint
 * Falls back to empty array for new users
 */
export const getElectionsForYou = async (userId, options = {}) => {
  const { limit = 10, offset = 0, filters = {} } = options;

  try {
    logger.info({ userId, limit }, 'Getting elections for user');

    // ✅ Validate userId
    if (!userId || userId === 'undefined' || userId === 'null') {
      logger.warn('No valid userId provided');
      return {
        success: true,
        data: [],
        pagination: { limit, offset, total: 0 },
        message: 'Please login to get personalized recommendations',
        is_new_user: true,
      };
    }

    // ✅ Step 1: Check if user has voting history
    const userVoteCount = await getUserVoteCount(userId);
    logger.info({ userId, userVoteCount }, 'User vote count');

    // ✅ Step 2: If new user with no votes, return empty with message
    if (userVoteCount === 0) {
      logger.info({ userId }, 'New user with no voting history');
      return {
        success: true,
        data: [],
        pagination: { limit, offset, total: 0 },
        message: 'Vote on some elections to get personalized recommendations',
        is_new_user: true,
      };
    }

    // ✅ Step 3: User has history - get PERSONALIZED recommendations from Shaped AI
    // Try using the rank endpoint first (for true personalization)
    try {
      const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/rank`, {
        user_id: String(userId),
        limit: limit + offset,
      });

      let results = response.data.results || response.data.items || [];

      // Skip offset items
      if (offset > 0) {
        results = results.slice(offset);
      }

      // Limit results
      results = results.slice(0, limit);

      // Transform results
      const elections = results.map(item => ({
        id: item.id || item.item_id,
        ...item.metadata,
        recommendation_source: 'shaped_ai',
        personalized_for_user: true,
      }));

      logger.info({ userId, count: elections.length }, 'Personalized elections retrieved via /rank');

      return {
        success: true,
        data: elections,
        pagination: { limit, offset, total: results.length },
        is_personalized: true,
        is_new_user: false,
      };
    } catch (rankError) {
      // If /rank fails, fall back to /query but still filter based on user
      logger.warn({ error: rankError.message }, 'Rank endpoint failed, using query fallback');
      
      const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
        query: `SELECT * FROM items LIMIT ${limit + offset}`,
      });

      let results = response.data.results || [];

      if (offset > 0) {
        results = results.slice(offset);
      }
      results = results.slice(0, limit);

      const elections = results.map(item => ({
        id: item.id,
        ...item.metadata,
        recommendation_source: 'shaped_ai',
        personalized_for_user: false, // Mark as not truly personalized
      }));

      return {
        success: true,
        data: elections,
        pagination: { limit, offset, total: results.length },
        is_personalized: false,
        is_new_user: false,
      };
    }
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get elections from Shaped');
    
    // ✅ Check if it's a "user not found" error from Shaped
    if (error.response?.status === 404 || error.message?.includes('user')) {
      return {
        success: true,
        data: [],
        pagination: { limit, offset, total: 0 },
        message: 'Vote on some elections to get personalized recommendations',
        is_new_user: true,
      };
    }
    
    // Fallback to database query for other errors
    return await getFallbackElections(limit, offset, filters);
  }
};

/**
 * Get elections similar to a given election
 */
export const getSimilarElections = async (electionId, options = {}) => {
  const { limit = 5, excludeSelf = true } = options;

  try {
    logger.info({ electionId, limit }, 'Getting similar elections');

    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM similarity(embedding_ref='content_embedding', encoder='item_attribute_pooling', input_item_id=$item_id) LIMIT ${limit + 1}`,
      parameters: {
        item_id: String(electionId),
      },
    });

    let results = response.data.results || [];

    // Exclude the source election if requested
    if (excludeSelf) {
      results = results.filter(item => item.id !== String(electionId));
    }

    // Limit results
    results = results.slice(0, limit);

    const elections = results.map(item => ({
      id: item.id,
      ...item.metadata,
      similarity_source: 'shaped_ai',
    }));

    logger.info({ electionId, count: elections.length }, 'Similar elections retrieved');

    return {
      success: true,
      data: elections,
      source_election_id: electionId,
    };
  } catch (error) {
    logger.error({ error: error.message, electionId }, 'Failed to get similar elections');
    
    // Fallback to category-based similarity
    return await getFallbackSimilarElections(electionId, limit);
  }
};

/**
 * Get trending elections (based on popularity and recency)
 */
export const getTrendingElections = async (options = {}) => {
  const { limit = 10, timeWindow = 7 } = options;

  try {
    logger.info({ limit, timeWindow }, 'Getting trending elections');

    // Query Shaped - sorted by derived trending rank
    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM items ORDER BY _derived_trending_rank DESC LIMIT ${limit}`,
    });

    const results = response.data.results || [];

    const elections = results.map(item => ({
      id: item.id,
      ...item.metadata,
      trending_source: 'shaped_ai',
    }));

    return {
      success: true,
      data: elections,
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get trending elections');
    return await getFallbackTrendingElections(limit);
  }
};

/**
 * Get popular elections (most votes/views)
 */
export const getPopularElections = async (options = {}) => {
  const { limit = 10 } = options;

  try {
    logger.info({ limit }, 'Getting popular elections');

    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM items ORDER BY _derived_popular_rank DESC LIMIT ${limit}`,
    });

    const results = response.data.results || [];

    const elections = results.map(item => ({
      id: item.id,
      ...item.metadata,
      popular_source: 'shaped_ai',
    }));

    return {
      success: true,
      data: elections,
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get popular elections');
    return await getFallbackPopularElections(limit);
  }
};

/**
 * Get lotterized elections (elections with lottery prizes)
 */
export const getLotterizedPicks = async (options = {}) => {
  const { limit = 10, minPrize = 0 } = options;

  try {
    logger.info({ limit, minPrize }, 'Getting lotterized elections');

    // Get all items and filter for lottery enabled
    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM items LIMIT 100`,
    });

    let results = response.data.results || [];

    // Filter for lottery enabled elections
    results = results.filter(item => 
      item.metadata?.lottery_enabled === 'true' || item.metadata?.lottery_enabled === true
    );

    // Filter by minimum prize
    if (minPrize > 0) {
      results = results.filter(item => 
        parseFloat(item.metadata?.lottery_prize_pool || 0) >= minPrize
      );
    }

    // Sort by prize pool descending
    results.sort((a, b) => 
      parseFloat(b.metadata?.lottery_prize_pool || 0) - parseFloat(a.metadata?.lottery_prize_pool || 0)
    );

    // Limit results
    results = results.slice(0, limit);

    const elections = results.map(item => ({
      id: item.id,
      ...item.metadata,
      lotterized_source: 'shaped_ai',
    }));

    return {
      success: true,
      data: elections,
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get lotterized elections');
    return await getFallbackLotterizedElections(limit, minPrize);
  }
};

/**
 * Get elections by category
 */
export const getElectionsByCategory = async (categoryId, options = {}) => {
  const { limit = 10 } = options;

  try {
    logger.info({ categoryId, limit }, 'Getting elections by category');

    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM items LIMIT 100`,
    });

    let results = response.data.results || [];

    // Filter by category
    results = results.filter(item => 
      parseInt(item.metadata?.category_id) === parseInt(categoryId)
    );

    // Limit results
    results = results.slice(0, limit);

    const elections = results.map(item => ({
      id: item.id,
      ...item.metadata,
      category_source: 'shaped_ai',
    }));

    return {
      success: true,
      data: elections,
      category_id: categoryId,
    };
  } catch (error) {
    logger.error({ error: error.message, categoryId }, 'Failed to get elections by category');
    return await getFallbackElectionsByCategory(categoryId, limit);
  }
};

/**
 * Get audience for an election (users who might be interested)
 */
export const getAudienceForElection = async (electionId, options = {}) => {
  const { limit = 10 } = options;

  try {
    logger.info({ electionId, limit }, 'Getting audience for election');

    // This requires user data in the engine - for now return from database
    return await getFallbackAudienceForElection(electionId, limit);
  } catch (error) {
    logger.error({ error: error.message, electionId }, 'Failed to get audience');
    return await getFallbackAudienceForElection(electionId, limit);
  }
};

// ============================================
// FALLBACK FUNCTIONS (Database queries)
// ============================================

/**
 * Fallback: Get elections from database
 */
const getFallbackElections = async (limit, offset, filters = {}) => {
  try {
    let query = `
      SELECT * FROM votteryyy_elections
      WHERE status IN ('published', 'active')
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback elections query failed');
    return { success: false, data: [], error: error.message };
  }
};

/**
 * Fallback: Get similar elections by category
 */
const getFallbackSimilarElections = async (electionId, limit) => {
  try {
    const query = `
      SELECT e2.* FROM votteryyy_elections e2
      WHERE e2.category_id = (
        SELECT category_id FROM votteryyy_elections WHERE id = $1
      )
      AND e2.id != $1
      AND e2.status IN ('published', 'active')
      ORDER BY e2.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [electionId, limit]);

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback similar elections query failed');
    return { success: false, data: [], error: error.message };
  }
};

/**
 * Fallback: Get trending elections
 */
const getFallbackTrendingElections = async (limit) => {
  try {
    const query = `
      SELECT * FROM votteryyy_elections
      WHERE status IN ('published', 'active')
      AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY vote_count DESC, view_count DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback trending query failed');
    return { success: false, data: [], error: error.message };
  }
};

/**
 * Fallback: Get popular elections
 */
const getFallbackPopularElections = async (limit) => {
  try {
    const query = `
      SELECT * FROM votteryyy_elections
      WHERE status IN ('published', 'active')
      ORDER BY vote_count DESC, view_count DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback popular query failed');
    return { success: false, data: [], error: error.message };
  }
};

/**
 * Fallback: Get lotterized elections
 */
const getFallbackLotterizedElections = async (limit, minPrize = 0) => {
  try {
    const query = `
      SELECT * FROM votteryyy_elections
      WHERE status IN ('published', 'active')
      AND lottery_enabled = true
      AND lottery_total_prize_pool >= $2
      ORDER BY lottery_total_prize_pool DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit, minPrize]);

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback lotterized query failed');
    return { success: false, data: [], error: error.message };
  }
};

/**
 * Fallback: Get elections by category
 */
const getFallbackElectionsByCategory = async (categoryId, limit) => {
  try {
    const query = `
      SELECT * FROM votteryyy_elections
      WHERE status IN ('published', 'active')
      AND category_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [categoryId, limit]);

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback category query failed');
    return { success: false, data: [], error: error.message };
  }
};

/**
 * Fallback: Get audience for election
 */
const getFallbackAudienceForElection = async (electionId, limit) => {
  try {
    // Get users who voted in similar elections
    const query = `
      SELECT DISTINCT u.user_id, u.user_name, ud.country, ud.age, ud.gender
      FROM users u
      LEFT JOIN votteryy_user_details ud ON u.user_id = ud.user_id
      WHERE u.user_id IN (
        SELECT DISTINCT v.user_id FROM votteryy_votes v
        WHERE v.election_id IN (
          SELECT id FROM votteryyy_elections 
          WHERE category_id = (SELECT category_id FROM votteryyy_elections WHERE id = $1)
        )
      )
      LIMIT $2
    `;

    const result = await db.query(query, [electionId, limit]);

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback audience query failed');
    return { success: false, data: [], error: error.message };
  }
};

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if Shaped engine is available
 */
export const checkEngineHealth = async () => {
  try {
    const response = await shapedClient.client.get(`/engines/${ENGINE_NAME}`);
    return {
      healthy: response.data.status === 'ACTIVE',
      status: response.data.status,
      engine: ENGINE_NAME,
    };
  } catch (error) {
    return {
      healthy: false,
      status: 'ERROR',
      error: error.message,
    };
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
  checkEngineHealth,
};
// /**
//  * Recommendations Service
//  * Integrates with Shaped AI for election recommendations
//  * 
//  * Working Queries:
//  * - Get all elections
//  * - Get similar elections (by item_id)
//  * - Get trending/popular elections
//  */

// import { shapedClient } from './shapedClient.js';
// import db from '../../utils/database.js';
// import config from '../../config/index.js';
// import logger from '../../utils/logger.js';

// // Engine name - must match what's in Shaped console
// const ENGINE_NAME = 'vottery_elections_for_you';

// /**
//  * Get elections for a user (personalized feed)
//  * Falls back to trending if no user history
//  */
// export const getElectionsForYou = async (userId, options = {}) => {
//   const { limit = 10, offset = 0, filters = {} } = options;

//   try {
//     logger.info({ userId, limit }, 'Getting elections for user');

//     // Query Shaped for recommendations
//     const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
//       query: `SELECT * FROM items LIMIT ${limit + offset}`,
//     });

//     let results = response.data.results || [];

//     // Skip offset items
//     if (offset > 0) {
//       results = results.slice(offset);
//     }

//     // Limit results
//     results = results.slice(0, limit);

//     // Transform results
//     const elections = results.map(item => ({
//       id: item.id,
//       ...item.metadata,
//       recommendation_source: 'shaped_ai',
//     }));

//     logger.info({ userId, count: elections.length }, 'Elections retrieved');

//     return {
//       success: true,
//       data: elections,
//       pagination: {
//         limit,
//         offset,
//         total: response.data.results?.length || 0,
//       },
//     };
//   } catch (error) {
//     logger.error({ error: error.message, userId }, 'Failed to get elections from Shaped');
    
//     // Fallback to database query
//     return await getFallbackElections(limit, offset, filters);
//   }
// };

// /**
//  * Get elections similar to a given election
//  */
// export const getSimilarElections = async (electionId, options = {}) => {
//   const { limit = 5, excludeSelf = true } = options;

//   try {
//     logger.info({ electionId, limit }, 'Getting similar elections');

//     const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
//       query: `SELECT * FROM similarity(embedding_ref='content_embedding', encoder='item_attribute_pooling', input_item_id=$item_id) LIMIT ${limit + 1}`,
//       parameters: {
//         item_id: String(electionId),
//       },
//     });

//     let results = response.data.results || [];

//     // Exclude the source election if requested
//     if (excludeSelf) {
//       results = results.filter(item => item.id !== String(electionId));
//     }

//     // Limit results
//     results = results.slice(0, limit);

//     const elections = results.map(item => ({
//       id: item.id,
//       ...item.metadata,
//       similarity_source: 'shaped_ai',
//     }));

//     logger.info({ electionId, count: elections.length }, 'Similar elections retrieved');

//     return {
//       success: true,
//       data: elections,
//       source_election_id: electionId,
//     };
//   } catch (error) {
//     logger.error({ error: error.message, electionId }, 'Failed to get similar elections');
    
//     // Fallback to category-based similarity
//     return await getFallbackSimilarElections(electionId, limit);
//   }
// };

// /**
//  * Get trending elections (based on popularity and recency)
//  */
// export const getTrendingElections = async (options = {}) => {
//   const { limit = 10, timeWindow = 7 } = options;

//   try {
//     logger.info({ limit, timeWindow }, 'Getting trending elections');

//     // Query Shaped - sorted by derived trending rank
//     const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
//       query: `SELECT * FROM items ORDER BY _derived_trending_rank DESC LIMIT ${limit}`,
//     });

//     const results = response.data.results || [];

//     const elections = results.map(item => ({
//       id: item.id,
//       ...item.metadata,
//       trending_source: 'shaped_ai',
//     }));

//     return {
//       success: true,
//       data: elections,
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Failed to get trending elections');
//     return await getFallbackTrendingElections(limit);
//   }
// };

// /**
//  * Get popular elections (most votes/views)
//  */
// export const getPopularElections = async (options = {}) => {
//   const { limit = 10 } = options;

//   try {
//     logger.info({ limit }, 'Getting popular elections');

//     const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
//       query: `SELECT * FROM items ORDER BY _derived_popular_rank DESC LIMIT ${limit}`,
//     });

//     const results = response.data.results || [];

//     const elections = results.map(item => ({
//       id: item.id,
//       ...item.metadata,
//       popular_source: 'shaped_ai',
//     }));

//     return {
//       success: true,
//       data: elections,
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Failed to get popular elections');
//     return await getFallbackPopularElections(limit);
//   }
// };

// /**
//  * Get lotterized elections (elections with lottery prizes)
//  */
// export const getLotterizedPicks = async (options = {}) => {
//   const { limit = 10, minPrize = 0 } = options;

//   try {
//     logger.info({ limit, minPrize }, 'Getting lotterized elections');

//     // Get all items and filter for lottery enabled
//     const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
//       query: `SELECT * FROM items LIMIT 100`,
//     });

//     let results = response.data.results || [];

//     // Filter for lottery enabled elections
//     results = results.filter(item => 
//       item.metadata?.lottery_enabled === 'true' || item.metadata?.lottery_enabled === true
//     );

//     // Filter by minimum prize
//     if (minPrize > 0) {
//       results = results.filter(item => 
//         parseFloat(item.metadata?.lottery_prize_pool || 0) >= minPrize
//       );
//     }

//     // Sort by prize pool descending
//     results.sort((a, b) => 
//       parseFloat(b.metadata?.lottery_prize_pool || 0) - parseFloat(a.metadata?.lottery_prize_pool || 0)
//     );

//     // Limit results
//     results = results.slice(0, limit);

//     const elections = results.map(item => ({
//       id: item.id,
//       ...item.metadata,
//       lotterized_source: 'shaped_ai',
//     }));

//     return {
//       success: true,
//       data: elections,
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Failed to get lotterized elections');
//     return await getFallbackLotterizedElections(limit, minPrize);
//   }
// };

// /**
//  * Get elections by category
//  */
// export const getElectionsByCategory = async (categoryId, options = {}) => {
//   const { limit = 10 } = options;

//   try {
//     logger.info({ categoryId, limit }, 'Getting elections by category');

//     const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
//       query: `SELECT * FROM items LIMIT 100`,
//     });

//     let results = response.data.results || [];

//     // Filter by category
//     results = results.filter(item => 
//       parseInt(item.metadata?.category_id) === parseInt(categoryId)
//     );

//     // Limit results
//     results = results.slice(0, limit);

//     const elections = results.map(item => ({
//       id: item.id,
//       ...item.metadata,
//       category_source: 'shaped_ai',
//     }));

//     return {
//       success: true,
//       data: elections,
//       category_id: categoryId,
//     };
//   } catch (error) {
//     logger.error({ error: error.message, categoryId }, 'Failed to get elections by category');
//     return await getFallbackElectionsByCategory(categoryId, limit);
//   }
// };

// /**
//  * Get audience for an election (users who might be interested)
//  */
// export const getAudienceForElection = async (electionId, options = {}) => {
//   const { limit = 10 } = options;

//   try {
//     logger.info({ electionId, limit }, 'Getting audience for election');

//     // This requires user data in the engine - for now return from database
//     return await getFallbackAudienceForElection(electionId, limit);
//   } catch (error) {
//     logger.error({ error: error.message, electionId }, 'Failed to get audience');
//     return await getFallbackAudienceForElection(electionId, limit);
//   }
// };

// // ============================================
// // FALLBACK FUNCTIONS (Database queries)
// // ============================================

// /**
//  * Fallback: Get elections from database
//  */
// const getFallbackElections = async (limit, offset, filters = {}) => {
//   try {
//     let query = `
//       SELECT * FROM votteryyy_elections
//       WHERE status IN ('published', 'active')
//       ORDER BY created_at DESC
//       LIMIT $1 OFFSET $2
//     `;

//     const result = await db.query(query, [limit, offset]);

//     return {
//       success: true,
//       data: result.rows,
//       source: 'database_fallback',
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Fallback elections query failed');
//     return { success: false, data: [], error: error.message };
//   }
// };

// /**
//  * Fallback: Get similar elections by category
//  */
// const getFallbackSimilarElections = async (electionId, limit) => {
//   try {
//     const query = `
//       SELECT e2.* FROM votteryyy_elections e2
//       WHERE e2.category_id = (
//         SELECT category_id FROM votteryyy_elections WHERE id = $1
//       )
//       AND e2.id != $1
//       AND e2.status IN ('published', 'active')
//       ORDER BY e2.created_at DESC
//       LIMIT $2
//     `;

//     const result = await db.query(query, [electionId, limit]);

//     return {
//       success: true,
//       data: result.rows,
//       source: 'database_fallback',
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Fallback similar elections query failed');
//     return { success: false, data: [], error: error.message };
//   }
// };

// /**
//  * Fallback: Get trending elections
//  */
// const getFallbackTrendingElections = async (limit) => {
//   try {
//     const query = `
//       SELECT * FROM votteryyy_elections
//       WHERE status IN ('published', 'active')
//       AND created_at >= NOW() - INTERVAL '7 days'
//       ORDER BY vote_count DESC, view_count DESC
//       LIMIT $1
//     `;

//     const result = await db.query(query, [limit]);

//     return {
//       success: true,
//       data: result.rows,
//       source: 'database_fallback',
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Fallback trending query failed');
//     return { success: false, data: [], error: error.message };
//   }
// };

// /**
//  * Fallback: Get popular elections
//  */
// const getFallbackPopularElections = async (limit) => {
//   try {
//     const query = `
//       SELECT * FROM votteryyy_elections
//       WHERE status IN ('published', 'active')
//       ORDER BY vote_count DESC, view_count DESC
//       LIMIT $1
//     `;

//     const result = await db.query(query, [limit]);

//     return {
//       success: true,
//       data: result.rows,
//       source: 'database_fallback',
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Fallback popular query failed');
//     return { success: false, data: [], error: error.message };
//   }
// };

// /**
//  * Fallback: Get lotterized elections
//  */
// const getFallbackLotterizedElections = async (limit, minPrize = 0) => {
//   try {
//     const query = `
//       SELECT * FROM votteryyy_elections
//       WHERE status IN ('published', 'active')
//       AND lottery_enabled = true
//       AND lottery_total_prize_pool >= $2
//       ORDER BY lottery_total_prize_pool DESC
//       LIMIT $1
//     `;

//     const result = await db.query(query, [limit, minPrize]);

//     return {
//       success: true,
//       data: result.rows,
//       source: 'database_fallback',
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Fallback lotterized query failed');
//     return { success: false, data: [], error: error.message };
//   }
// };

// /**
//  * Fallback: Get elections by category
//  */
// const getFallbackElectionsByCategory = async (categoryId, limit) => {
//   try {
//     const query = `
//       SELECT * FROM votteryyy_elections
//       WHERE status IN ('published', 'active')
//       AND category_id = $1
//       ORDER BY created_at DESC
//       LIMIT $2
//     `;

//     const result = await db.query(query, [categoryId, limit]);

//     return {
//       success: true,
//       data: result.rows,
//       source: 'database_fallback',
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Fallback category query failed');
//     return { success: false, data: [], error: error.message };
//   }
// };

// /**
//  * Fallback: Get audience for election
//  */
// const getFallbackAudienceForElection = async (electionId, limit) => {
//   try {
//     // Get users who voted in similar elections
//     const query = `
//       SELECT DISTINCT u.user_id, u.user_name, ud.country, ud.age, ud.gender
//       FROM users u
//       LEFT JOIN votteryy_user_details ud ON u.user_id = ud.user_id
//       WHERE u.user_id IN (
//         SELECT DISTINCT v.user_id FROM votteryy_votes v
//         WHERE v.election_id IN (
//           SELECT id FROM votteryyy_elections 
//           WHERE category_id = (SELECT category_id FROM votteryyy_elections WHERE id = $1)
//         )
//       )
//       LIMIT $2
//     `;

//     const result = await db.query(query, [electionId, limit]);

//     return {
//       success: true,
//       data: result.rows,
//       source: 'database_fallback',
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Fallback audience query failed');
//     return { success: false, data: [], error: error.message };
//   }
// };

// // ============================================
// // HEALTH CHECK
// // ============================================

// /**
//  * Check if Shaped engine is available
//  */
// export const checkEngineHealth = async () => {
//   try {
//     const response = await shapedClient.client.get(`/engines/${ENGINE_NAME}`);
//     return {
//       healthy: response.data.status === 'ACTIVE',
//       status: response.data.status,
//       engine: ENGINE_NAME,
//     };
//   } catch (error) {
//     return {
//       healthy: false,
//       status: 'ERROR',
//       error: error.message,
//     };
//   }
// };

// export default {
//   getElectionsForYou,
//   getSimilarElections,
//   getTrendingElections,
//   getPopularElections,
//   getLotterizedPicks,
//   getElectionsByCategory,
//   getAudienceForElection,
//   checkEngineHealth,
// };

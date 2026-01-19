/**
 * Recommendations Service
 * Integrates with Shaped AI for election recommendations
 * 
 * Working Queries:
 * - Get all elections
 * - Get similar elections (by item_id)
 * - Get trending/popular elections
 */

import { shapedClient } from './shapedClient.js';
import db from '../../utils/database.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

// Engine name - must match what's in Shaped console
const ENGINE_NAME = 'vottery_elections_for_you';

/**
 * Get elections for a user (personalized feed)
 * Falls back to trending if no user history
 */
export const getElectionsForYou = async (userId, options = {}) => {
  const { limit = 10, offset = 0, filters = {} } = options;

  try {
    logger.info({ userId, limit }, 'Getting elections for user');

    // Query Shaped for recommendations
    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM items LIMIT ${limit + offset}`,
    });

    let results = response.data.results || [];

    // Skip offset items
    if (offset > 0) {
      results = results.slice(offset);
    }

    // Limit results
    results = results.slice(0, limit);

    // Transform results
    const elections = results.map(item => ({
      id: item.id,
      ...item.metadata,
      recommendation_source: 'shaped_ai',
    }));

    logger.info({ userId, count: elections.length }, 'Elections retrieved');

    return {
      success: true,
      data: elections,
      pagination: {
        limit,
        offset,
        total: response.data.results?.length || 0,
      },
    };
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get elections from Shaped');
    
    // Fallback to database query
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
//  * Recommendation Service
//  */

// import { shapedClient } from './shapedClient.js';
// //import config from '../../config/config.js';
// import config from '../../config/index.js';
// import logger from '../../utils/logger.js';
// import db from '../../utils/database.js';

// const formatRecommendationResponse = (shapedResponse) => {
//   const { ids = [], scores = [], metadata = [] } = shapedResponse;
//   return ids.map((id, index) => ({
//     electionId: id,
//     score: scores[index] || 0,
//     metadata: metadata[index] || {},
//   }));
// };

// const getFallbackRecommendations = async (limit = 20) => {
//   try {
//     const query = `
//       SELECT e.id as election_id, e.title, e.category, e.is_lotterized, e.prize_amount, e.participation_fee,
//         COALESCE(vote_count.total, 0) as total_votes
//       FROM elections e
//       LEFT JOIN (SELECT election_id, COUNT(*) as total FROM votes GROUP BY election_id) vote_count ON e.id = vote_count.election_id
//       WHERE e.status = 'active' AND e.start_date <= NOW() AND e.end_date >= NOW()
//       ORDER BY vote_count.total DESC NULLS LAST, e.created_at DESC
//       LIMIT $1
//     `;
    
//     const result = await db.query(query, [limit]);
    
//     return result.rows.map(row => ({
//       electionId: String(row.election_id),
//       score: 0.5,
//       metadata: { title: row.title, category: row.category, is_lotterized: row.is_lotterized, prize_amount: row.prize_amount },
//     }));
//   } catch (error) {
//     logger.error({ error: error.message }, 'Fallback recommendations failed');
//     return [];
//   }
// };

// export const getElectionsForYou = async (params) => {
//   const { userId, limit = 20, filters = {} } = params;

//   try {
//     let filterPredicate = "status = 'active' AND is_active = true";
//     if (filters.category) filterPredicate += ` AND category = '${filters.category}'`;
//     if (filters.isLotterized !== undefined) filterPredicate += ` AND is_lotterized = ${filters.isLotterized}`;
//     if (filters.maxFee !== undefined) filterPredicate += ` AND participation_fee <= ${filters.maxFee}`;
//     if (filters.votingType) filterPredicate += ` AND voting_type = '${filters.votingType}'`;

//     const result = await shapedClient.rank({
//       modelName: config.shaped.models.electionsForYou,
//       userId: String(userId),
//       limit,
//       returnMetadata: true,
//       filterPredicate,
//     });

//     logger.debug({ userId, count: result.ids?.length || 0 }, 'Elections for you fetched');
//     return { success: true, elections: formatRecommendationResponse(result) };
//   } catch (error) {
//     logger.error({ userId, error: error.message }, 'Failed to get elections for you');
//     return { success: false, error: error.message, elections: await getFallbackRecommendations(limit) };
//   }
// };

// export const getSimilarElections = async (params) => {
//   const { electionId, limit = 10 } = params;

//   try {
//     const result = await shapedClient.similarItems({
//       modelName: config.shaped.models.similarElections,
//       itemId: String(electionId),
//       limit,
//       returnMetadata: true,
//     });

//     logger.debug({ electionId, count: result.ids?.length || 0 }, 'Similar elections fetched');
//     return { success: true, elections: formatRecommendationResponse(result) };
//   } catch (error) {
//     logger.error({ electionId, error: error.message }, 'Failed to get similar elections');
//     return { success: false, error: error.message, elections: [] };
//   }
// };

// export const getTrendingElections = async (params = {}) => {
//   const { region = null, limit = 20 } = params;

//   try {
//     const filterPredicate = "status = 'active' AND is_active = true";
    
//     const result = await shapedClient.rank({
//       modelName: config.shaped.models.trendingElections,
//       userId: '__TRENDING__',
//       limit,
//       returnMetadata: true,
//       filterPredicate,
//     });

//     logger.debug({ region, count: result.ids?.length || 0 }, 'Trending elections fetched');
//     return { success: true, elections: formatRecommendationResponse(result) };
//   } catch (error) {
//     logger.error({ region, error: error.message }, 'Failed to get trending elections');
//     return { success: false, error: error.message, elections: await getFallbackRecommendations(limit) };
//   }
// };

// export const getAudienceForElection = async (params) => {
//   const { electionId, limit = 100 } = params;

//   try {
//     const result = await shapedClient.rank({
//       modelName: config.shaped.models.audienceMatching,
//       userId: `election:${electionId}`,
//       limit,
//       returnMetadata: true,
//     });

//     logger.debug({ electionId, count: result.ids?.length || 0 }, 'Audience for election fetched');
//     return { success: true, potentialVoters: result.ids || [], scores: result.scores || [], metadata: result.metadata || [] };
//   } catch (error) {
//     logger.error({ electionId, error: error.message }, 'Failed to get audience for election');
//     return { success: false, error: error.message, potentialVoters: [] };
//   }
// };

// export const getLotterizedPicks = async (params) => {
//   const { userId, limit = 10 } = params;

//   try {
//     const filterPredicate = "status = 'active' AND is_active = true AND is_lotterized = true AND prize_amount > 0";
    
//     const result = await shapedClient.rank({
//       modelName: config.shaped.models.electionsForYou,
//       userId: String(userId),
//       limit,
//       returnMetadata: true,
//       filterPredicate,
//     });

//     const elections = formatRecommendationResponse(result);
//     elections.sort((a, b) => (b.metadata?.prize_amount || 0) - (a.metadata?.prize_amount || 0));

//     logger.debug({ userId, count: elections.length }, 'Lotterized picks fetched');
//     return { success: true, elections };
//   } catch (error) {
//     logger.error({ userId, error: error.message }, 'Failed to get lotterized picks');
//     return { success: false, error: error.message, elections: [] };
//   }
// };

// export const getElectionsByCategory = async (params) => {
//   const { userId, rowLimit = 5, colLimit = 10 } = params;

//   try {
//     const result = await shapedClient.rankAttributeGrid({
//       modelName: config.shaped.models.electionsForYou,
//       userId: String(userId),
//       attributeName: 'category',
//       rowLimit,
//       colLimit,
//       returnMetadata: true,
//     });

//     logger.debug({ userId, categoryCount: result.rows?.length || 0 }, 'Elections by category fetched');
//     return { success: true, categories: result.rows || [] };
//   } catch (error) {
//     logger.error({ userId, error: error.message }, 'Failed to get elections by category');
//     return { success: false, error: error.message, categories: [] };
//   }
// };

// export default {
//   getElectionsForYou, getSimilarElections, getTrendingElections,
//   getAudienceForElection, getLotterizedPicks, getElectionsByCategory,
// };
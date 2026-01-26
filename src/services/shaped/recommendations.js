//last code only showing active election above code
/**
 * Recommendations Service
 * Integrates with Shaped AI for election recommendations
 * 
 * ✅ FIXED: Now properly uses userId for personalized recommendations
 * ✅ FIXED: Reads userId from headers (x-user-id) or query params
 * ✅ NEW: Returns user_vote_count and trending elections for new users
 * ✅ FIXED: Date filtering now handles Shaped AI date format correctly
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
 * ✅ Get trending elections for new users
 */
const getTrendingForNewUsers = async (limit) => {
  try {
    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM items LIMIT ${limit * 3}`,
    });

    const results = response.data.results || [];

    return results.map(item => ({
      id: item.id,
      ...item.metadata,
      recommendation_source: 'shaped_ai',
      recommendation_type: 'trending',
      personalized_for_user: false,
    }));
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get trending for new users');
    return [];
  }
};

/**
 * ✅ FIXED: Filter to only return active elections (not ended, not draft)
 * Now properly handles Shaped AI date format (no timezone = treat as UTC)
 */
const filterActiveElections = (elections) => {
  const now = new Date();
  
  logger.info({ 
    inputCount: elections.length, 
    nowISO: now.toISOString() 
  }, 'filterActiveElections: Starting');
  
  const filtered = elections.filter(election => {
    const electionId = election.id || election.election_id;
    
    // Check status - skip draft/cancelled
    const status = (election.status || '').toLowerCase();
    if (status === 'draft' || status === 'cancelled') {
      logger.debug({ id: electionId, status }, 'Filtered: draft/cancelled');
      return false;
    }
    
    // Parse end_date
    if (election.end_date) {
      let dateStr = String(election.end_date);
      
      // ✅ FIX: Shaped AI returns dates like "2026-01-31T03:57:00" without timezone
      // Append 'Z' to treat as UTC if no timezone specified
      if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
        dateStr = dateStr + 'Z';
      }
      
      const endDate = new Date(dateStr);
      
      // Check if date parsing succeeded
      if (isNaN(endDate.getTime())) {
        logger.warn({ id: electionId, end_date: election.end_date }, 'Invalid date, including election');
        return true; // Include if can't parse
      }
      
      // Filter out if ended
      if (endDate < now) {
        logger.debug({ 
          id: electionId, 
          endDate: endDate.toISOString(),
          now: now.toISOString(),
          title: (election.title || '').substring(0, 25)
        }, 'Filtered: ended');
        return false;
      }
    }
    
    return true;
  });
  
  logger.info({ 
    inputCount: elections.length,
    outputCount: filtered.length, 
    filteredOut: elections.length - filtered.length 
  }, 'filterActiveElections: Complete');
  
  return filtered;
};

/**
 * Get elections for a user (personalized feed)
 * ✅ FIXED: Now checks user voting history and uses Shaped /rank endpoint
 * ✅ NEW: Returns trending elections for new users instead of empty
 * ✅ NEW: Filters out ended elections
 */
export const getElectionsForYou = async (userId, options = {}) => {
  const { limit = 10, offset = 0, filters = {} } = options;

  try {
    logger.info({ userId, limit }, 'Getting elections for user');

    // ✅ Validate userId
    if (!userId || userId === 'undefined' || userId === 'null') {
      logger.warn('No valid userId provided');
      const trendingElections = await getTrendingForNewUsers(limit);
      const activeElections = filterActiveElections(trendingElections);
      return {
        success: true,
        data: activeElections.slice(0, limit),
        pagination: { limit, offset, total: activeElections.length },
        message: 'Please login to get personalized recommendations. Showing trending elections.',
        is_new_user: true,
        user_vote_count: 0,
        recommendation_type: 'trending',
      };
    }

    // ✅ Step 1: Check if user has voting history
    const userVoteCount = await getUserVoteCount(userId);
    logger.info({ userId, userVoteCount }, 'User vote count');

    // ✅ Step 2: If new user with no votes, return TRENDING elections with clear message
    if (userVoteCount === 0) {
      logger.info({ userId }, 'New user with no voting history - returning trending');
      const trendingElections = await getTrendingForNewUsers(limit);
      const activeElections = filterActiveElections(trendingElections);
      return {
        success: true,
        data: activeElections.slice(0, limit),
        pagination: { limit, offset, total: activeElections.length },
        message: 'You have not voted yet. Showing trending elections to get you started!',
        is_new_user: true,
        user_vote_count: 0,
        recommendation_type: 'trending',
      };
    }

    // ✅ Step 3: User has history - get PERSONALIZED recommendations from Shaped AI
    try {
      const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/rank`, {
        user_id: String(userId),
        limit: (limit + offset) * 3,
      });

      let results = response.data.results || response.data.items || [];

      if (offset > 0) {
        results = results.slice(offset);
      }

      let elections = results.map(item => ({
        id: item.id || item.item_id,
        ...item.metadata,
        recommendation_source: 'shaped_ai',
        recommendation_type: 'personalized',
        personalized_for_user: true,
      }));

      // ✅ Filter to only show active elections
      elections = filterActiveElections(elections);
      elections = elections.slice(0, limit);

      logger.info({ userId, count: elections.length }, 'Personalized elections retrieved via /rank');

      return {
        success: true,
        data: elections,
        pagination: { limit, offset, total: elections.length },
        message: `Based on your ${userVoteCount} vote${userVoteCount > 1 ? 's' : ''}, here are elections recommended for you.`,
        is_personalized: true,
        is_new_user: false,
        user_vote_count: userVoteCount,
        recommendation_type: 'personalized',
      };
    } catch (rankError) {
      logger.warn({ error: rankError.message }, 'Rank endpoint failed, using query fallback');
      
      const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
        query: `SELECT * FROM items LIMIT ${(limit + offset) * 3}`,
      });

      let results = response.data.results || [];

      if (offset > 0) {
        results = results.slice(offset);
      }

      let elections = results.map(item => ({
        id: item.id,
        ...item.metadata,
        recommendation_source: 'shaped_ai',
        recommendation_type: 'general',
        personalized_for_user: false,
      }));

      // ✅ Filter to only show active elections
      elections = filterActiveElections(elections);
      elections = elections.slice(0, limit);

      return {
        success: true,
        data: elections,
        pagination: { limit, offset, total: elections.length },
        message: `Based on your ${userVoteCount} vote${userVoteCount > 1 ? 's' : ''}, here are elections you might like.`,
        is_personalized: false,
        is_new_user: false,
        user_vote_count: userVoteCount,
        recommendation_type: 'general',
      };
    }
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get elections from Shaped');
    
    if (error.response?.status === 404 || error.message?.includes('user')) {
      const trendingElections = await getTrendingForNewUsers(limit);
      const activeElections = filterActiveElections(trendingElections);
      return {
        success: true,
        data: activeElections.slice(0, limit),
        pagination: { limit, offset, total: activeElections.length },
        message: 'Showing trending elections. Vote to get personalized recommendations!',
        is_new_user: true,
        user_vote_count: 0,
        recommendation_type: 'trending',
      };
    }
    
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

// ============================================
// MINIMAL PATCH - Only replace these 2 functions
// Keep EVERYTHING else in your file unchanged
// ============================================

/**
 * ✅ FIXED: Get trending elections (based on recency + engagement score + activity)
 * REPLACE your existing getTrendingElections function with this one
 */
export const getTrendingElections = async (options = {}) => {
  const { limit = 10, timeWindow = 7 } = options;

  try {
    logger.info({ limit, timeWindow }, 'Getting trending elections');

    // Query Shaped to get all items
    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM items LIMIT 100`,
    });

    let results = response.data.results || [];
    
    logger.info({ rawCount: results.length }, 'Raw results from Shaped for trending');

    // If no results from Shaped, try fallback immediately
    if (results.length === 0) {
      logger.warn('No results from Shaped, using fallback');
      return await getFallbackTrendingElections(limit);
    }

    // ✅ Calculate trending score for each election
    const now = new Date();
    const timeWindowMs = timeWindow * 24 * 60 * 60 * 1000;

    let elections = results.map(item => {
      const metadata = item.metadata || {};
      const electionData = {
        id: item.id,
        ...metadata,
        trending_source: 'shaped_ai',
      };

      // Calculate trending score
      let trendingScore = 0;

      // Factor 1: Recency (max 40 points)
      const createdAt = new Date(metadata.created_at || metadata.start_date || now);
      const ageMs = Math.max(0, now - createdAt);
      if (ageMs < timeWindowMs) {
        trendingScore += Math.max(0, 40 * (1 - ageMs / timeWindowMs));
      } else {
        trendingScore += 5; // Small base score for older elections
      }

      // Factor 2: Engagement score (max 30 points)
      const engagementScore = parseFloat(metadata.engagement_score || 0.1);
      trendingScore += engagementScore * 30;

      // Factor 3: Vote count (max 20 points)
      const voteCount = parseInt(metadata.vote_count || 0);
      trendingScore += Math.min(20, voteCount * 2);

      // Factor 4: View count (max 10 points)
      const viewCount = parseInt(metadata.view_count || 0);
      trendingScore += Math.min(10, viewCount * 0.5);

      electionData._trending_score = trendingScore;
      return electionData;
    });

    // ✅ Filter active elections
    elections = filterActiveElections(elections);
    
    logger.info({ afterFilterCount: elections.length }, 'After filtering for trending');

    // If all filtered out, return from fallback
    if (elections.length === 0) {
      logger.warn('All elections filtered out, using fallback');
      return await getFallbackTrendingElections(limit);
    }

    // ✅ Sort by trending score (highest first)
    elections.sort((a, b) => (b._trending_score || 0) - (a._trending_score || 0));

    // Take top results
    elections = elections.slice(0, limit);

    logger.info({ finalCount: elections.length }, 'Trending elections ready');

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
 * ✅ FIXED: Get popular elections (most votes/views all-time)
 * REPLACE your existing getPopularElections function with this one
 */
export const getPopularElections = async (options = {}) => {
  const { limit = 10 } = options;

  try {
    logger.info({ limit }, 'Getting popular elections');

    const response = await shapedClient.client.post(`/engines/${ENGINE_NAME}/query`, {
      query: `SELECT * FROM items LIMIT 100`,
    });

    let results = response.data.results || [];
    
    logger.info({ rawCount: results.length }, 'Raw results from Shaped for popular');

    // If no results from Shaped, try fallback immediately
    if (results.length === 0) {
      logger.warn('No results from Shaped, using fallback');
      return await getFallbackPopularElections(limit);
    }

    // ✅ Calculate popularity score for each election
    let elections = results.map(item => {
      const metadata = item.metadata || {};
      const electionData = {
        id: item.id,
        ...metadata,
        popular_source: 'shaped_ai',
      };

      // Calculate popularity score
      let popularityScore = 0;

      // Factor 1: Total votes (max 50 points)
      const voteCount = parseInt(metadata.vote_count || 0);
      popularityScore += Math.min(50, voteCount * 5);

      // Factor 2: Total views (max 25 points)
      const viewCount = parseInt(metadata.view_count || 0);
      popularityScore += Math.min(25, viewCount * 0.5);

      // Factor 3: Engagement score (max 15 points)
      const engagementScore = parseFloat(metadata.engagement_score || 0.1);
      popularityScore += engagementScore * 15;

      // Factor 4: Prize pool bonus (max 10 points) - elections with prizes are more attractive
      const prizePool = parseFloat(metadata.lottery_prize_pool || 0);
      if (prizePool > 0) {
        popularityScore += Math.min(10, prizePool / 1000);
      }

      // Base score so nothing is zero
      popularityScore += 1;

      electionData._popularity_score = popularityScore;
      return electionData;
    });

    // ✅ Filter active elections
    elections = filterActiveElections(elections);
    
    logger.info({ afterFilterCount: elections.length }, 'After filtering for popular');

    // If all filtered out, return from fallback
    if (elections.length === 0) {
      logger.warn('All elections filtered out, using fallback');
      return await getFallbackPopularElections(limit);
    }

    // ✅ Sort by popularity score (highest first)
    elections.sort((a, b) => (b._popularity_score || 0) - (a._popularity_score || 0));

    // Take top results
    elections = elections.slice(0, limit);

    logger.info({ finalCount: elections.length }, 'Popular elections ready');

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

    let elections = results.map(item => ({
      id: item.id,
      ...item.metadata,
      lotterized_source: 'shaped_ai',
    }));

    // Filter active elections
    elections = filterActiveElections(elections);
    elections = elections.slice(0, limit);

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

    let elections = results.map(item => ({
      id: item.id,
      ...item.metadata,
      category_source: 'shaped_ai',
    }));

    // Filter active elections
    elections = filterActiveElections(elections);
    elections = elections.slice(0, limit);

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
      AND end_date > NOW()
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
      AND e2.end_date > NOW()
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
 * Fallback: Get trending elections from database
 */
const getFallbackTrendingElections = async (limit) => {
  try {
    // Changed: Removed the strict vote_count/view_count ordering
    // Now uses created_at as primary sort for new platforms with no votes yet
    const query = `
      SELECT * FROM votteryyy_elections
      WHERE status IN ('published', 'active')
      AND end_date > NOW()
      ORDER BY 
        created_at DESC,
        vote_count DESC, 
        view_count DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);

    logger.info({ count: result.rows.length }, 'Fallback trending elections from DB');

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback trending query failed');
    return { success: true, data: [], error: error.message };
  }
};

/**
 * Fallback: Get popular elections
 */
/**
 * Fallback: Get popular elections from database
 */
const getFallbackPopularElections = async (limit) => {
  try {
    // Changed: Added created_at as tiebreaker and lottery_prize_pool as factor
    const query = `
      SELECT * FROM votteryyy_elections
      WHERE status IN ('published', 'active')
      AND end_date > NOW()
      ORDER BY 
        vote_count DESC, 
        view_count DESC,
        COALESCE(lottery_total_prize_pool, 0) DESC,
        created_at DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);

    logger.info({ count: result.rows.length }, 'Fallback popular elections from DB');

    return {
      success: true,
      data: result.rows,
      source: 'database_fallback',
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Fallback popular query failed');
    return { success: true, data: [], error: error.message };
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
      AND end_date > NOW()
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
      AND end_date > NOW()
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

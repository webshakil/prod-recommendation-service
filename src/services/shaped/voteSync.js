/**
 * Vote Sync Service
 * Syncs voting data from PostgreSQL to Shaped AI vottery_events table
 * 
 * Combines data from:
 * - votteryy_votes (regular votes with user identity)
 * - votteryyy_anonymous_votes (anonymous votes)
 * - votteryyy_voter_participation (participation tracking)
 */

import { v4 as uuidv4 } from 'uuid';
import { shapedClient } from './shapedClient.js';
import db from '../../utils/database.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { EVENT_TYPES, getEventLabel } from './eventTypes.js';

/**
 * Fetch regular votes from votteryy_votes table
 */
const fetchRegularVotes = async (limit = 1000, offset = 0, since = null) => {
  let query = `
    SELECT 
      v.id,
      v.voting_id,
      v.user_id,
      v.election_id,
      v.status,
      v.is_edited,
      v.anonymous,
      v.created_at,
      v.updated_at
    FROM votteryy_votes v
    WHERE v.status = 'valid'
  `;

  const params = [];
  let paramIndex = 1;

  if (since) {
    query += ` AND v.created_at >= $${paramIndex}`;
    params.push(since);
    paramIndex++;
  }

  query += ` ORDER BY v.created_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Fetch anonymous votes from votteryyy_anonymous_votes table
 */
const fetchAnonymousVotes = async (limit = 1000, offset = 0, since = null) => {
  let query = `
    SELECT 
      av.id,
      av.voting_id,
      av.election_id,
      av.vote_token,
      av.voting_session_id,
      av.voted_at as created_at
    FROM votteryyy_anonymous_votes av
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (since) {
    query += ` AND av.voted_at >= $${paramIndex}`;
    params.push(since);
    paramIndex++;
  }

  query += ` ORDER BY av.voted_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Fetch voter participation records
 */
const fetchVoterParticipation = async (limit = 1000, offset = 0, since = null) => {
  let query = `
    SELECT 
      vp.id,
      vp.election_id,
      vp.user_id,
      vp.has_voted,
      vp.voting_session_id,
      vp.voted_at,
      vp.created_at
    FROM votteryyy_voter_participation vp
    WHERE vp.has_voted = true
  `;

  const params = [];
  let paramIndex = 1;

  if (since) {
    query += ` AND vp.voted_at >= $${paramIndex}`;
    params.push(since);
    paramIndex++;
  }

  query += ` ORDER BY vp.voted_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Transform regular vote to Shaped event format
 */
const transformRegularVoteToEvent = (vote) => {
  const eventType = EVENT_TYPES?.VOTE_CAST || 'vote_cast';
  let label = 1.0;
  
  try {
    label = getEventLabel ? getEventLabel(eventType) : 1.0;
  } catch (e) {
    label = 1.0;
  }

  return {
    event_id: vote.voting_id || uuidv4(),
    user_id: String(vote.user_id),
    item_id: String(vote.election_id),
    event_type: eventType,
    label: label,
    metadata: JSON.stringify({
      source: 'regular_vote',
      vote_id: vote.id,
      is_edited: vote.is_edited || false,
      is_anonymous: vote.anonymous || false,
      status: vote.status,
    }),
    created_at: vote.created_at ? new Date(vote.created_at).toISOString() : new Date().toISOString(),
  };
};

/**
 * Transform anonymous vote to Shaped event format
 */
const transformAnonymousVoteToEvent = (vote) => {
  const anonymousUserId = vote.voting_session_id 
    ? `anon_${vote.voting_session_id}` 
    : `anon_${vote.vote_token?.substring(0, 16) || uuidv4()}`;

  return {
    event_id: vote.voting_id || uuidv4(),
    user_id: anonymousUserId,
    item_id: String(vote.election_id),
    event_type: 'anonymous_vote',
    label: 0.8,
    metadata: JSON.stringify({
      source: 'anonymous_vote',
      vote_id: vote.id,
      is_anonymous: true,
    }),
    created_at: vote.created_at ? new Date(vote.created_at).toISOString() : new Date().toISOString(),
  };
};

/**
 * Transform participation record to Shaped event format
 */
const transformParticipationToEvent = (participation) => {
  return {
    event_id: participation.voting_session_id || uuidv4(),
    user_id: String(participation.user_id),
    item_id: String(participation.election_id),
    event_type: 'participation',
    label: 0.5,
    metadata: JSON.stringify({
      source: 'voter_participation',
      participation_id: participation.id,
      has_voted: participation.has_voted,
    }),
    created_at: participation.voted_at 
      ? new Date(participation.voted_at).toISOString() 
      : new Date(participation.created_at).toISOString(),
  };
};

/**
 * Sync all regular votes to Shaped
 */
export const syncRegularVotesToShaped = async (options = {}) => {
  const { since = null } = options;
  const batchSize = config.sync?.batchSize || 1000;
  let totalSynced = 0;
  let offset = 0;
  let hasMore = true;

  logger.info({ since }, 'Starting regular votes sync');

  try {
    while (hasMore) {
      const votes = await fetchRegularVotes(batchSize, offset, since);

      if (votes.length === 0) {
        hasMore = false;
        break;
      }

      const transformedEvents = votes.map(transformRegularVoteToEvent);
      await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

      totalSynced += votes.length;
      offset += batchSize;

      logger.debug({ batchCount: votes.length, totalSynced }, 'Regular votes batch synced');

      if (votes.length < batchSize) hasMore = false;
    }

    logger.info({ totalSynced }, 'Regular votes sync completed');
    return { success: true, totalSynced, type: 'regular_votes' };
  } catch (error) {
    logger.error({ error: error.message, totalSynced }, 'Regular votes sync failed');
    throw error;
  }
};

/**
 * Sync all anonymous votes to Shaped
 */
export const syncAnonymousVotesToShaped = async (options = {}) => {
  const { since = null } = options;
  const batchSize = config.sync?.batchSize || 1000;
  let totalSynced = 0;
  let offset = 0;
  let hasMore = true;

  logger.info({ since }, 'Starting anonymous votes sync');

  try {
    while (hasMore) {
      const votes = await fetchAnonymousVotes(batchSize, offset, since);

      if (votes.length === 0) {
        hasMore = false;
        break;
      }

      const transformedEvents = votes.map(transformAnonymousVoteToEvent);
      await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

      totalSynced += votes.length;
      offset += batchSize;

      logger.debug({ batchCount: votes.length, totalSynced }, 'Anonymous votes batch synced');

      if (votes.length < batchSize) hasMore = false;
    }

    logger.info({ totalSynced }, 'Anonymous votes sync completed');
    return { success: true, totalSynced, type: 'anonymous_votes' };
  } catch (error) {
    logger.error({ error: error.message, totalSynced }, 'Anonymous votes sync failed');
    throw error;
  }
};

/**
 * Sync voter participation to Shaped
 */
export const syncParticipationToShaped = async (options = {}) => {
  const { since = null } = options;
  const batchSize = config.sync?.batchSize || 1000;
  let totalSynced = 0;
  let offset = 0;
  let hasMore = true;

  logger.info({ since }, 'Starting participation sync');

  try {
    while (hasMore) {
      const participations = await fetchVoterParticipation(batchSize, offset, since);

      if (participations.length === 0) {
        hasMore = false;
        break;
      }

      const transformedEvents = participations.map(transformParticipationToEvent);
      await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

      totalSynced += participations.length;
      offset += batchSize;

      logger.debug({ batchCount: participations.length, totalSynced }, 'Participation batch synced');

      if (participations.length < batchSize) hasMore = false;
    }

    logger.info({ totalSynced }, 'Participation sync completed');
    return { success: true, totalSynced, type: 'participation' };
  } catch (error) {
    logger.error({ error: error.message, totalSynced }, 'Participation sync failed');
    throw error;
  }
};

/**
 * Sync all voting data to Shaped
 */
export const syncAllVotesToShaped = async (options = {}) => {
  const { includeParticipation = false, since = null } = options;

  logger.info({ includeParticipation, since }, 'Starting full votes sync');

  const results = {
    regularVotes: { success: false, totalSynced: 0 },
    anonymousVotes: { success: false, totalSynced: 0 },
    participation: { success: false, totalSynced: 0, skipped: !includeParticipation },
  };

  try {
    results.regularVotes = await syncRegularVotesToShaped({ since });
  } catch (error) {
    results.regularVotes = { success: false, error: error.message };
    logger.error({ error: error.message }, 'Failed to sync regular votes');
  }

  try {
    results.anonymousVotes = await syncAnonymousVotesToShaped({ since });
  } catch (error) {
    results.anonymousVotes = { success: false, error: error.message };
    logger.error({ error: error.message }, 'Failed to sync anonymous votes');
  }

  if (includeParticipation) {
    try {
      results.participation = await syncParticipationToShaped({ since });
    } catch (error) {
      results.participation = { success: false, error: error.message };
      logger.error({ error: error.message }, 'Failed to sync participation');
    }
  }

  const totalSynced = 
    (results.regularVotes.totalSynced || 0) + 
    (results.anonymousVotes.totalSynced || 0) + 
    (results.participation.totalSynced || 0);

  logger.info({ totalSynced, results }, 'Full votes sync completed');

  return {
    success: true,
    totalSynced,
    details: results,
  };
};

/**
 * Sync a single vote to Shaped (real-time)
 */
export const syncSingleVote = async (voteData) => {
  const { userId, electionId, isAnonymous = false, votingId, metadata = {} } = voteData;

  try {
    const event = {
      event_id: votingId || uuidv4(),
      user_id: isAnonymous ? `anon_${uuidv4()}` : String(userId),
      item_id: String(electionId),
      event_type: isAnonymous ? 'anonymous_vote' : 'vote_cast',
      label: isAnonymous ? 0.8 : 1.0,
      metadata: JSON.stringify({
        ...metadata,
        source: 'realtime_sync',
        is_anonymous: isAnonymous,
      }),
      created_at: new Date().toISOString(),
    };

    await shapedClient.insertTable(config.shaped.datasets.events, [event]);
    
    logger.debug({ userId, electionId, isAnonymous }, 'Single vote synced');
    return { success: true, event };
  } catch (error) {
    logger.error({ error: error.message, userId, electionId }, 'Failed to sync single vote');
    throw error;
  }
};

/**
 * Get vote counts for monitoring
 */
export const getVoteCounts = async () => {
  try {
    const regularQuery = `SELECT COUNT(*) as count FROM votteryy_votes WHERE status = 'valid'`;
    const anonymousQuery = `SELECT COUNT(*) as count FROM votteryyy_anonymous_votes`;
    const participationQuery = `SELECT COUNT(*) as count FROM votteryyy_voter_participation WHERE has_voted = true`;

    const [regular, anonymous, participation] = await Promise.all([
      db.query(regularQuery),
      db.query(anonymousQuery),
      db.query(participationQuery),
    ]);

    return {
      regularVotes: parseInt(regular.rows[0].count, 10),
      anonymousVotes: parseInt(anonymous.rows[0].count, 10),
      participationRecords: parseInt(participation.rows[0].count, 10),
      total: parseInt(regular.rows[0].count, 10) + parseInt(anonymous.rows[0].count, 10),
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get vote counts');
    throw error;
  }
};

export default {
  syncRegularVotesToShaped,
  syncAnonymousVotesToShaped,
  syncParticipationToShaped,
  syncAllVotesToShaped,
  syncSingleVote,
  getVoteCounts,
};
// /**
//  * Vote Sync Service
//  * Syncs voting data from PostgreSQL to Shaped AI vottery_events table
//  * 
//  * Combines data from:
//  * - votteryy_votes (regular votes with user identity)
//  * - votteryyy_anonymous_votes (anonymous votes)
//  * - votteryyy_voter_participation (participation tracking)
//  */

// import { v4 as uuidv4 } from 'uuid';
// import { shapedClient } from './shapedClient.js';
// import db from '../../utils/database.js';
// import config from '../../config/index.js';
// import logger from '../../utils/logger.js';
// import { EVENT_TYPES, getEventLabel } from './eventTypes.js';

// /**
//  * Fetch regular votes from votteryy_votes table
//  */
// const fetchRegularVotes = async (limit = 1000, offset = 0, since = null) => {
//   let query = `
//     SELECT 
//       v.id,
//       v.voting_id,
//       v.user_id,
//       v.election_id,
//       v.status,
//       v.is_edited,
//       v.anonymous,
//       v.created_at,
//       v.updated_at
//     FROM votteryy_votes v
//     WHERE v.status = 'valid'
//   `;

//   const params = [];
//   let paramIndex = 1;

//   if (since) {
//     query += ` AND v.created_at >= $${paramIndex}`;
//     params.push(since);
//     paramIndex++;
//   }

//   query += ` ORDER BY v.created_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
//   params.push(limit, offset);

//   const result = await db.query(query, params);
//   return result.rows;
// };

// /**
//  * Fetch anonymous votes from votteryyy_anonymous_votes table
//  */
// const fetchAnonymousVotes = async (limit = 1000, offset = 0, since = null) => {
//   let query = `
//     SELECT 
//       av.id,
//       av.voting_id,
//       av.election_id,
//       av.vote_token,
//       av.voting_session_id,
//       av.voted_at as created_at
//     FROM votteryyy_anonymous_votes av
//     WHERE 1=1
//   `;

//   const params = [];
//   let paramIndex = 1;

//   if (since) {
//     query += ` AND av.voted_at >= $${paramIndex}`;
//     params.push(since);
//     paramIndex++;
//   }

//   query += ` ORDER BY av.voted_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
//   params.push(limit, offset);

//   const result = await db.query(query, params);
//   return result.rows;
// };

// /**
//  * Fetch voter participation records
//  */
// const fetchVoterParticipation = async (limit = 1000, offset = 0, since = null) => {
//   let query = `
//     SELECT 
//       vp.id,
//       vp.election_id,
//       vp.user_id,
//       vp.has_voted,
//       vp.voting_session_id,
//       vp.voted_at,
//       vp.created_at
//     FROM votteryyy_voter_participation vp
//     WHERE vp.has_voted = true
//   `;

//   const params = [];
//   let paramIndex = 1;

//   if (since) {
//     query += ` AND vp.voted_at >= $${paramIndex}`;
//     params.push(since);
//     paramIndex++;
//   }

//   query += ` ORDER BY vp.voted_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
//   params.push(limit, offset);

//   const result = await db.query(query, params);
//   return result.rows;
// };

// /**
//  * Transform regular vote to Shaped event format
//  */
// const transformRegularVoteToEvent = (vote) => {
//   const eventType = EVENT_TYPES?.VOTE_CAST || 'vote_cast';
//   let label = 1.0;
  
//   try {
//     label = getEventLabel ? getEventLabel(eventType) : 1.0;
//   } catch (e) {
//     label = 1.0;
//   }

//   return {
//     event_id: vote.voting_id || uuidv4(),
//     user_id: String(vote.user_id),
//     item_id: String(vote.election_id),
//     event_type: eventType,
//     label: label,
//     metadata: JSON.stringify({
//       source: 'regular_vote',
//       vote_id: vote.id,
//       is_edited: vote.is_edited || false,
//       is_anonymous: vote.anonymous || false,
//       status: vote.status,
//     }),
//     created_at: vote.created_at ? new Date(vote.created_at).toISOString() : new Date().toISOString(),
//   };
// };

// /**
//  * Transform anonymous vote to Shaped event format
//  */
// const transformAnonymousVoteToEvent = (vote) => {
//   const anonymousUserId = vote.voting_session_id 
//     ? `anon_${vote.voting_session_id}` 
//     : `anon_${vote.vote_token?.substring(0, 16) || uuidv4()}`;

//   return {
//     event_id: vote.voting_id || uuidv4(),
//     user_id: anonymousUserId,
//     item_id: String(vote.election_id),
//     event_type: 'anonymous_vote',
//     label: 0.8,
//     metadata: JSON.stringify({
//       source: 'anonymous_vote',
//       vote_id: vote.id,
//       is_anonymous: true,
//     }),
//     created_at: vote.created_at ? new Date(vote.created_at).toISOString() : new Date().toISOString(),
//   };
// };

// /**
//  * Transform participation record to Shaped event format
//  */
// const transformParticipationToEvent = (participation) => {
//   return {
//     event_id: participation.voting_session_id || uuidv4(),
//     user_id: String(participation.user_id),
//     item_id: String(participation.election_id),
//     event_type: 'participation',
//     label: 0.5,
//     metadata: JSON.stringify({
//       source: 'voter_participation',
//       participation_id: participation.id,
//       has_voted: participation.has_voted,
//     }),
//     created_at: participation.voted_at 
//       ? new Date(participation.voted_at).toISOString() 
//       : new Date(participation.created_at).toISOString(),
//   };
// };

// /**
//  * Sync all regular votes to Shaped
//  */
// export const syncRegularVotesToShaped = async (options = {}) => {
//   const { since = null } = options;
//   const batchSize = config.sync?.batchSize || 1000;
//   let totalSynced = 0;
//   let offset = 0;
//   let hasMore = true;

//   logger.info({ since }, 'Starting regular votes sync');

//   try {
//     while (hasMore) {
//       const votes = await fetchRegularVotes(batchSize, offset, since);

//       if (votes.length === 0) {
//         hasMore = false;
//         break;
//       }

//       const transformedEvents = votes.map(transformRegularVoteToEvent);
//       await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

//       totalSynced += votes.length;
//       offset += batchSize;

//       logger.debug({ batchCount: votes.length, totalSynced }, 'Regular votes batch synced');

//       if (votes.length < batchSize) hasMore = false;
//     }

//     logger.info({ totalSynced }, 'Regular votes sync completed');
//     return { success: true, totalSynced, type: 'regular_votes' };
//   } catch (error) {
//     logger.error({ error: error.message, totalSynced }, 'Regular votes sync failed');
//     throw error;
//   }
// };

// /**
//  * Sync all anonymous votes to Shaped
//  */
// export const syncAnonymousVotesToShaped = async (options = {}) => {
//   const { since = null } = options;
//   const batchSize = config.sync?.batchSize || 1000;
//   let totalSynced = 0;
//   let offset = 0;
//   let hasMore = true;

//   logger.info({ since }, 'Starting anonymous votes sync');

//   try {
//     while (hasMore) {
//       const votes = await fetchAnonymousVotes(batchSize, offset, since);

//       if (votes.length === 0) {
//         hasMore = false;
//         break;
//       }

//       const transformedEvents = votes.map(transformAnonymousVoteToEvent);
//       await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

//       totalSynced += votes.length;
//       offset += batchSize;

//       logger.debug({ batchCount: votes.length, totalSynced }, 'Anonymous votes batch synced');

//       if (votes.length < batchSize) hasMore = false;
//     }

//     logger.info({ totalSynced }, 'Anonymous votes sync completed');
//     return { success: true, totalSynced, type: 'anonymous_votes' };
//   } catch (error) {
//     logger.error({ error: error.message, totalSynced }, 'Anonymous votes sync failed');
//     throw error;
//   }
// };

// /**
//  * Sync voter participation to Shaped
//  */
// export const syncParticipationToShaped = async (options = {}) => {
//   const { since = null } = options;
//   const batchSize = config.sync?.batchSize || 1000;
//   let totalSynced = 0;
//   let offset = 0;
//   let hasMore = true;

//   logger.info({ since }, 'Starting participation sync');

//   try {
//     while (hasMore) {
//       const participations = await fetchVoterParticipation(batchSize, offset, since);

//       if (participations.length === 0) {
//         hasMore = false;
//         break;
//       }

//       const transformedEvents = participations.map(transformParticipationToEvent);
//       await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

//       totalSynced += participations.length;
//       offset += batchSize;

//       logger.debug({ batchCount: participations.length, totalSynced }, 'Participation batch synced');

//       if (participations.length < batchSize) hasMore = false;
//     }

//     logger.info({ totalSynced }, 'Participation sync completed');
//     return { success: true, totalSynced, type: 'participation' };
//   } catch (error) {
//     logger.error({ error: error.message, totalSynced }, 'Participation sync failed');
//     throw error;
//   }
// };

// /**
//  * Sync all voting data to Shaped
//  */
// export const syncAllVotesToShaped = async (options = {}) => {
//   const { includeParticipation = false, since = null } = options;

//   logger.info({ includeParticipation, since }, 'Starting full votes sync');

//   const results = {
//     regularVotes: { success: false, totalSynced: 0 },
//     anonymousVotes: { success: false, totalSynced: 0 },
//     participation: { success: false, totalSynced: 0, skipped: !includeParticipation },
//   };

//   try {
//     results.regularVotes = await syncRegularVotesToShaped({ since });
//   } catch (error) {
//     results.regularVotes = { success: false, error: error.message };
//     logger.error({ error: error.message }, 'Failed to sync regular votes');
//   }

//   try {
//     results.anonymousVotes = await syncAnonymousVotesToShaped({ since });
//   } catch (error) {
//     results.anonymousVotes = { success: false, error: error.message };
//     logger.error({ error: error.message }, 'Failed to sync anonymous votes');
//   }

//   if (includeParticipation) {
//     try {
//       results.participation = await syncParticipationToShaped({ since });
//     } catch (error) {
//       results.participation = { success: false, error: error.message };
//       logger.error({ error: error.message }, 'Failed to sync participation');
//     }
//   }

//   const totalSynced = 
//     (results.regularVotes.totalSynced || 0) + 
//     (results.anonymousVotes.totalSynced || 0) + 
//     (results.participation.totalSynced || 0);

//   logger.info({ totalSynced, results }, 'Full votes sync completed');

//   return {
//     success: true,
//     totalSynced,
//     details: results,
//   };
// };

// /**
//  * Sync a single vote to Shaped (real-time)
//  */
// export const syncSingleVote = async (voteData) => {
//   const { userId, electionId, isAnonymous = false, votingId, metadata = {} } = voteData;

//   try {
//     const event = {
//       event_id: votingId || uuidv4(),
//       user_id: isAnonymous ? `anon_${uuidv4()}` : String(userId),
//       item_id: String(electionId),
//       event_type: isAnonymous ? 'anonymous_vote' : 'vote_cast',
//       label: isAnonymous ? 0.8 : 1.0,
//       metadata: JSON.stringify({
//         ...metadata,
//         source: 'realtime_sync',
//         is_anonymous: isAnonymous,
//       }),
//       created_at: new Date().toISOString(),
//     };

//     await shapedClient.insertTable(config.shaped.datasets.events, [event]);
    
//     logger.debug({ userId, electionId, isAnonymous }, 'Single vote synced');
//     return { success: true, event };
//   } catch (error) {
//     logger.error({ error: error.message, userId, electionId }, 'Failed to sync single vote');
//     throw error;
//   }
// };

// /**
//  * Get vote counts for monitoring
//  */
// export const getVoteCounts = async () => {
//   try {
//     const regularQuery = `SELECT COUNT(*) as count FROM votteryy_votes WHERE status = 'valid'`;
//     const anonymousQuery = `SELECT COUNT(*) as count FROM votteryyy_anonymous_votes`;
//     const participationQuery = `SELECT COUNT(*) as count FROM votteryyy_voter_participation WHERE has_voted = true`;

//     const [regular, anonymous, participation] = await Promise.all([
//       db.query(regularQuery),
//       db.query(anonymousQuery),
//       db.query(participationQuery),
//     ]);

//     return {
//       regularVotes: parseInt(regular.rows[0].count, 10),
//       anonymousVotes: parseInt(anonymous.rows[0].count, 10),
//       participationRecords: parseInt(participation.rows[0].count, 10),
//       total: parseInt(regular.rows[0].count, 10) + parseInt(anonymous.rows[0].count, 10),
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Failed to get vote counts');
//     throw error;
//   }
// };

// export default {
//   syncRegularVotesToShaped,
//   syncAnonymousVotesToShaped,
//   syncParticipationToShaped,
//   syncAllVotesToShaped,
//   syncSingleVote,
//   getVoteCounts,
// };
// /**
//  * Vote Sync Service
//  * Syncs voting data from PostgreSQL to Shaped AI vottery_events table
//  * 
//  * Combines data from:
//  * - votteryy_votes (regular votes with user identity)
//  * - votteryyy_anonymous_votes (anonymous votes)
//  * - votteryyy_voter_participation (participation tracking)
//  */

// import { v4 as uuidv4 } from 'uuid';
// import { shapedClient } from './shapedClient.js';
// import db from '../../utils/database.js';
// import config from '../../config/index.js';
// import logger from '../../utils/logger.js';
// import { EVENT_TYPES, getEventLabel } from './eventTypes.js';

// /**
//  * Fetch regular votes from votteryy_votes table
//  */
// const fetchRegularVotes = async (limit = 1000, offset = 0, since = null) => {
//   let query = `
//     SELECT 
//       v.id,
//       v.voting_id,
//       v.user_id,
//       v.election_id,
//       v.status,
//       v.is_edited,
//       v.anonymous,
//       v.created_at,
//       v.updated_at
//     FROM votteryy_votes v
//     WHERE v.status = 'valid'
//   `;

//   const params = [];
//   let paramIndex = 1;

//   if (since) {
//     query += ` AND v.created_at >= $${paramIndex}`;
//     params.push(since);
//     paramIndex++;
//   }

//   query += ` ORDER BY v.created_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
//   params.push(limit, offset);

//   const result = await db.query(query, params);
//   return result.rows;
// };

// /**
//  * Fetch anonymous votes from votteryyy_anonymous_votes table
//  */
// const fetchAnonymousVotes = async (limit = 1000, offset = 0, since = null) => {
//   let query = `
//     SELECT 
//       av.id,
//       av.voting_id,
//       av.election_id,
//       av.vote_token,
//       av.voting_session_id,
//       av.voted_at as created_at
//     FROM votteryyy_anonymous_votes av
//     WHERE 1=1
//   `;

//   const params = [];
//   let paramIndex = 1;

//   if (since) {
//     query += ` AND av.voted_at >= $${paramIndex}`;
//     params.push(since);
//     paramIndex++;
//   }

//   query += ` ORDER BY av.voted_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
//   params.push(limit, offset);

//   const result = await db.query(query, params);
//   return result.rows;
// };

// /**
//  * Fetch voter participation records
//  */
// const fetchVoterParticipation = async (limit = 1000, offset = 0, since = null) => {
//   let query = `
//     SELECT 
//       vp.id,
//       vp.election_id,
//       vp.user_id,
//       vp.has_voted,
//       vp.voting_session_id,
//       vp.voted_at,
//       vp.created_at
//     FROM votteryyy_voter_participation vp
//     WHERE vp.has_voted = true
//   `;

//   const params = [];
//   let paramIndex = 1;

//   if (since) {
//     query += ` AND vp.voted_at >= $${paramIndex}`;
//     params.push(since);
//     paramIndex++;
//   }

//   query += ` ORDER BY vp.voted_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
//   params.push(limit, offset);

//   const result = await db.query(query, params);
//   return result.rows;
// };

// /**
//  * Transform regular vote to Shaped event format
//  */
// const transformRegularVoteToEvent = (vote) => {
//   return {
//     event_id: vote.voting_id || uuidv4(),
//     user_id: String(vote.user_id),
//     item_id: String(vote.election_id),
//     event_type: EVENT_TYPES.VOTE_CAST || 'vote_cast',
//     label: getEventLabel ? getEventLabel(EVENT_TYPES.VOTE_CAST || 'vote_cast') : 1.0,
//     metadata: JSON.stringify({
//       source: 'regular_vote',
//       vote_id: vote.id,
//       is_edited: vote.is_edited || false,
//       is_anonymous: vote.anonymous || false,
//       status: vote.status,
//     }),
//     created_at: vote.created_at ? new Date(vote.created_at).toISOString() : new Date().toISOString(),
//   };
// };

// /**
//  * Transform anonymous vote to Shaped event format
//  * For anonymous votes, we use a hashed token as user_id to maintain some pattern learning
//  * while preserving anonymity
//  */
// const transformAnonymousVoteToEvent = (vote) => {
//   // Use voting_session_id or generate anonymous user id
//   const anonymousUserId = vote.voting_session_id 
//     ? `anon_${vote.voting_session_id}` 
//     : `anon_${vote.vote_token?.substring(0, 16) || uuidv4()}`;

//   return {
//     event_id: vote.voting_id || uuidv4(),
//     user_id: anonymousUserId,
//     item_id: String(vote.election_id),
//     event_type: 'anonymous_vote',
//     label: 0.8, // Slightly lower weight for anonymous votes (less personalization signal)
//     metadata: JSON.stringify({
//       source: 'anonymous_vote',
//       vote_id: vote.id,
//       is_anonymous: true,
//     }),
//     created_at: vote.created_at ? new Date(vote.created_at).toISOString() : new Date().toISOString(),
//   };
// };

// /**
//  * Transform participation record to Shaped event format
//  * This is useful for tracking engagement even if we already have the vote
//  */
// const transformParticipationToEvent = (participation) => {
//   return {
//     event_id: participation.voting_session_id || uuidv4(),
//     user_id: String(participation.user_id),
//     item_id: String(participation.election_id),
//     event_type: 'participation',
//     label: 0.5, // Lower weight - participation is implicit from voting
//     metadata: JSON.stringify({
//       source: 'voter_participation',
//       participation_id: participation.id,
//       has_voted: participation.has_voted,
//     }),
//     created_at: participation.voted_at 
//       ? new Date(participation.voted_at).toISOString() 
//       : new Date(participation.created_at).toISOString(),
//   };
// };

// /**
//  * Sync all regular votes to Shaped
//  */
// export const syncRegularVotesToShaped = async (options = {}) => {
//   const { since = null } = options;
//   const batchSize = config.sync?.batchSize || 1000;
//   let totalSynced = 0;
//   let offset = 0;
//   let hasMore = true;

//   logger.info({ since }, 'Starting regular votes sync');

//   try {
//     while (hasMore) {
//       const votes = await fetchRegularVotes(batchSize, offset, since);

//       if (votes.length === 0) {
//         hasMore = false;
//         break;
//       }

//       const transformedEvents = votes.map(transformRegularVoteToEvent);
//       await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

//       totalSynced += votes.length;
//       offset += batchSize;

//       logger.debug({ batchCount: votes.length, totalSynced }, 'Regular votes batch synced');

//       if (votes.length < batchSize) hasMore = false;
//     }

//     logger.info({ totalSynced }, 'Regular votes sync completed');
//     return { success: true, totalSynced, type: 'regular_votes' };
//   } catch (error) {
//     logger.error({ error: error.message, totalSynced }, 'Regular votes sync failed');
//     throw error;
//   }
// };

// /**
//  * Sync all anonymous votes to Shaped
//  */
// export const syncAnonymousVotesToShaped = async (options = {}) => {
//   const { since = null } = options;
//   const batchSize = config.sync?.batchSize || 1000;
//   let totalSynced = 0;
//   let offset = 0;
//   let hasMore = true;

//   logger.info({ since }, 'Starting anonymous votes sync');

//   try {
//     while (hasMore) {
//       const votes = await fetchAnonymousVotes(batchSize, offset, since);

//       if (votes.length === 0) {
//         hasMore = false;
//         break;
//       }

//       const transformedEvents = votes.map(transformAnonymousVoteToEvent);
//       await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

//       totalSynced += votes.length;
//       offset += batchSize;

//       logger.debug({ batchCount: votes.length, totalSynced }, 'Anonymous votes batch synced');

//       if (votes.length < batchSize) hasMore = false;
//     }

//     logger.info({ totalSynced }, 'Anonymous votes sync completed');
//     return { success: true, totalSynced, type: 'anonymous_votes' };
//   } catch (error) {
//     logger.error({ error: error.message, totalSynced }, 'Anonymous votes sync failed');
//     throw error;
//   }
// };

// /**
//  * Sync voter participation to Shaped (optional - provides additional signal)
//  * Note: You may want to skip this if you're already syncing votes
//  * as it could create duplicate events for the same action
//  */
// export const syncParticipationToShaped = async (options = {}) => {
//   const { since = null, skipIfVotesExist = true } = options;
//   const batchSize = config.sync?.batchSize || 1000;
//   let totalSynced = 0;
//   let offset = 0;
//   let hasMore = true;

//   logger.info({ since, skipIfVotesExist }, 'Starting participation sync');

//   try {
//     while (hasMore) {
//       const participations = await fetchVoterParticipation(batchSize, offset, since);

//       if (participations.length === 0) {
//         hasMore = false;
//         break;
//       }

//       // Optionally skip participation records that already have votes synced
//       // For now, we'll sync all since participation provides lottery eligibility info
//       const transformedEvents = participations.map(transformParticipationToEvent);
//       await shapedClient.insertTable(config.shaped.datasets.events, transformedEvents);

//       totalSynced += participations.length;
//       offset += batchSize;

//       logger.debug({ batchCount: participations.length, totalSynced }, 'Participation batch synced');

//       if (participations.length < batchSize) hasMore = false;
//     }

//     logger.info({ totalSynced }, 'Participation sync completed');
//     return { success: true, totalSynced, type: 'participation' };
//   } catch (error) {
//     logger.error({ error: error.message, totalSynced }, 'Participation sync failed');
//     throw error;
//   }
// };

// /**
//  * Sync all voting data to Shaped
//  * Combines regular votes, anonymous votes, and optionally participation
//  */
// export const syncAllVotesToShaped = async (options = {}) => {
//   const { includeParticipation = false, since = null } = options;

//   logger.info({ includeParticipation, since }, 'Starting full votes sync');

//   const results = {
//     regularVotes: { success: false, totalSynced: 0 },
//     anonymousVotes: { success: false, totalSynced: 0 },
//     participation: { success: false, totalSynced: 0, skipped: !includeParticipation },
//   };

//   try {
//     // Sync regular votes
//     results.regularVotes = await syncRegularVotesToShaped({ since });
//   } catch (error) {
//     results.regularVotes = { success: false, error: error.message };
//     logger.error({ error: error.message }, 'Failed to sync regular votes');
//   }

//   try {
//     // Sync anonymous votes
//     results.anonymousVotes = await syncAnonymousVotesToShaped({ since });
//   } catch (error) {
//     results.anonymousVotes = { success: false, error: error.message };
//     logger.error({ error: error.message }, 'Failed to sync anonymous votes');
//   }

//   // Optionally sync participation (usually not needed if votes are synced)
//   if (includeParticipation) {
//     try {
//       results.participation = await syncParticipationToShaped({ since });
//     } catch (error) {
//       results.participation = { success: false, error: error.message };
//       logger.error({ error: error.message }, 'Failed to sync participation');
//     }
//   }

//   const totalSynced = 
//     (results.regularVotes.totalSynced || 0) + 
//     (results.anonymousVotes.totalSynced || 0) + 
//     (results.participation.totalSynced || 0);

//   logger.info({ totalSynced, results }, 'Full votes sync completed');

//   return {
//     success: true,
//     totalSynced,
//     details: results,
//   };
// };

// /**
//  * Sync a single vote to Shaped (real-time)
//  * Call this when a new vote is cast
//  */
// export const syncSingleVote = async (voteData) => {
//   const { userId, electionId, isAnonymous = false, votingId, metadata = {} } = voteData;

//   try {
//     const event = {
//       event_id: votingId || uuidv4(),
//       user_id: isAnonymous ? `anon_${uuidv4()}` : String(userId),
//       item_id: String(electionId),
//       event_type: isAnonymous ? 'anonymous_vote' : 'vote_cast',
//       label: isAnonymous ? 0.8 : 1.0,
//       metadata: JSON.stringify({
//         ...metadata,
//         source: 'realtime_sync',
//         is_anonymous: isAnonymous,
//       }),
//       created_at: new Date().toISOString(),
//     };

//     await shapedClient.insertTable(config.shaped.datasets.events, [event]);
    
//     logger.debug({ userId, electionId, isAnonymous }, 'Single vote synced');
//     return { success: true, event };
//   } catch (error) {
//     logger.error({ error: error.message, userId, electionId }, 'Failed to sync single vote');
//     throw error;
//   }
// };

// /**
//  * Get vote counts for monitoring
//  */
// export const getVoteCounts = async () => {
//   try {
//     const regularQuery = `SELECT COUNT(*) as count FROM votteryy_votes WHERE status = 'valid'`;
//     const anonymousQuery = `SELECT COUNT(*) as count FROM votteryyy_anonymous_votes`;
//     const participationQuery = `SELECT COUNT(*) as count FROM votteryyy_voter_participation WHERE has_voted = true`;

//     const [regular, anonymous, participation] = await Promise.all([
//       db.query(regularQuery),
//       db.query(anonymousQuery),
//       db.query(participationQuery),
//     ]);

//     return {
//       regularVotes: parseInt(regular.rows[0].count, 10),
//       anonymousVotes: parseInt(anonymous.rows[0].count, 10),
//       participationRecords: parseInt(participation.rows[0].count, 10),
//       total: parseInt(regular.rows[0].count, 10) + parseInt(anonymous.rows[0].count, 10),
//     };
//   } catch (error) {
//     logger.error({ error: error.message }, 'Failed to get vote counts');
//     throw error;
//   }
// };

// export default {
//   syncRegularVotesToShaped,
//   syncAnonymousVotesToShaped,
//   syncParticipationToShaped,
//   syncAllVotesToShaped,
//   syncSingleVote,
//   getVoteCounts,
// };
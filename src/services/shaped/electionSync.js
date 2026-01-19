/**
 * Election Sync Service
 */

import { shapedClient } from './shapedClient.js';
import db from '../../utils/database.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

export const ELECTION_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const VOTING_TYPES = {
  PLURALITY: 'plurality',
  RANKED_CHOICE: 'ranked_choice',
  APPROVAL: 'approval',
};

const fetchElectionsFromDB = async (limit = 1000, offset = 0, filters = {}) => {
  let query = `
    SELECT 
      e.id as election_id,
      e.creator_id,
      e.creator_type,
      e.title,
      e.description,
      e.slug,
      e.category_id,
      e.voting_type,
      e.permission_type,
      e.allowed_countries,
      e.is_free,
      e.pricing_type,
      e.general_participation_fee,
      e.biometric_required,
      e.start_date,
      e.start_time,
      e.end_date,
      e.end_time,
      e.timezone,
      e.status,
      e.view_count,
      e.vote_count,
      e.lottery_enabled,
      e.lottery_reward_type,
      e.lottery_total_prize_pool,
      e.lottery_winner_count,
      e.video_watch_required,
      e.created_at,
      e.updated_at,
      e.published_at
    FROM votteryyy_elections e
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (filters.status) {
    query += ` AND e.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.since) {
    query += ` AND e.updated_at >= $${paramIndex}`;
    params.push(filters.since);
    paramIndex++;
  }

  query += ` ORDER BY e.id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
};

const calculateEngagementScore = (election) => {
  let score = 0;
  
  if (election.status === ELECTION_STATUS.ACTIVE) score += 0.3;
  if (election.lottery_enabled) score += 0.2;
  if (parseFloat(election.lottery_total_prize_pool) > 0) {
    score += Math.min(parseFloat(election.lottery_total_prize_pool) / 10000, 0.2);
  }
  
  const viewCount = parseInt(election.view_count) || 0;
  const voteCount = parseInt(election.vote_count) || 0;
  if (viewCount > 0) {
    const conversionRate = voteCount / viewCount;
    score += Math.min(conversionRate * 0.3, 0.3);
  }
  
  return Math.min(score, 1);
};

const transformElectionForShaped = (election) => {
  const now = new Date();
  const startDate = new Date(election.start_date);
  const endDate = new Date(election.end_date);
  
  const isActive = election.status === ELECTION_STATUS.ACTIVE && now >= startDate && now <= endDate;
  
  // Only return fields that exist in Shaped table schema
  return {
    item_id: String(election.election_id),
    election_id: String(election.election_id),
    creator_id: String(election.creator_id),
    creatro_type: election.creator_type || 'individual',  // Note: typo in schema, must match
    title: election.title || '',
    description: election.description || '',
    slug: election.slug || '',
    category_id: parseInt(election.category_id) || 0,
    voting_type: election.voting_type || VOTING_TYPES.PLURALITY,
    permission_type: election.permission_type || 'public',
    is_free: Boolean(election.is_free !== false),
    pricing_type: election.pricing_type || 'free',
    participation_fee: parseFloat(election.general_participation_fee) || 0.0,
    biometric_required: Boolean(election.biometric_required),
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    timezone: election.timezone || 'UTC',
    status: election.status || ELECTION_STATUS.DRAFT,
    view_count: parseInt(election.view_count) || 0,
    vote_count: parseInt(election.vote_count) || 0,
    lottery_enabled: Boolean(election.lottery_enabled),
    lottery_reward_type: election.lottery_reward_type || '',
    lottery_prize_pool: parseFloat(election.lottery_total_prize_pool) || 0.0,
    lottery_winner_count: parseInt(election.lottery_winner_count) || 1,
    video_watch_required: Boolean(election.video_watch_required),
    engagement_score: parseFloat(calculateEngagementScore(election)) || 0.0,
    is_active: Boolean(isActive),
    days_remaining: Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))),
    created_at: election.created_at ? new Date(election.created_at).toISOString() : new Date().toISOString(),
    updated_at: election.updated_at ? new Date(election.updated_at).toISOString() : new Date().toISOString(),
  };
};

export const syncElectionsToShaped = async (options = {}) => {
  const { fullSync = false, since = null, status = null } = options;
  const batchSize = config.sync.batchSize;
  let totalSynced = 0;
  let offset = 0;
  let hasMore = true;

  logger.info({ fullSync, since, status }, 'Starting election sync');

  try {
    while (hasMore) {
      const filters = {};
      if (since) filters.since = since;
      if (status) filters.status = status;
      
      const elections = await fetchElectionsFromDB(batchSize, offset, filters);
      
      if (elections.length === 0) {
        hasMore = false;
        break;
      }

      const transformedElections = elections.map(transformElectionForShaped);
      await shapedClient.insertDataset(config.shaped.datasets.elections, transformedElections);

      totalSynced += elections.length;
      offset += batchSize;

      logger.debug({ batchCount: elections.length, totalSynced }, 'Election batch synced');

      if (elections.length < batchSize) hasMore = false;
    }

    logger.info({ totalSynced }, 'Election sync completed');
    return { success: true, totalSynced };
  } catch (error) {
    logger.error({ error: error.message, totalSynced }, 'Election sync failed');
    throw error;
  }
};

export const syncSingleElection = async (electionId) => {
  const query = `
    SELECT 
      e.id as election_id, e.creator_id, e.creator_type, e.title, e.description,
      e.slug, e.category_id, e.voting_type, e.permission_type, e.is_free,
      e.pricing_type, e.general_participation_fee, e.biometric_required,
      e.start_date, e.end_date, e.timezone, e.status, e.view_count, e.vote_count,
      e.lottery_enabled, e.lottery_reward_type, e.lottery_total_prize_pool,
      e.lottery_winner_count, e.video_watch_required, e.created_at, e.updated_at
    FROM votteryyy_elections e
    WHERE e.id = $1
  `;

  const result = await db.query(query, [electionId]);
  
  if (result.rows.length === 0) {
    logger.warn({ electionId }, 'Election not found for sync');
    return { success: false, reason: 'Election not found' };
  }

  const transformedElection = transformElectionForShaped(result.rows[0]);
  await shapedClient.insertDataset(config.shaped.datasets.elections, [transformedElection]);

  logger.debug({ electionId }, 'Single election synced');
  return { success: true, election: transformedElection };
};

export const getActiveElectionsCount = async () => {
  const query = `
    SELECT COUNT(*) as count FROM votteryyy_elections
    WHERE status = 'active' AND start_date <= NOW() AND end_date >= NOW()
  `;
  const result = await db.query(query);
  return parseInt(result.rows[0].count, 10);
};

export default { syncElectionsToShaped, syncSingleElection, getActiveElectionsCount, ELECTION_STATUS, VOTING_TYPES };
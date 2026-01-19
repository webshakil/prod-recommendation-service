/**
 * User Sync Service
 */

import { shapedClient } from './shapedClient.js';
import db from '../../utils/database.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

export const REGION_MAP = {
  'US': 1, 'CA': 1,
  'GB': 2, 'DE': 2, 'FR': 2, 'IT': 2, 'ES': 2, 'NL': 2, 'BE': 2, 'AT': 2, 'CH': 2, 'IE': 2, 'PT': 2, 'SE': 2, 'NO': 2, 'DK': 2, 'FI': 2,
  'RU': 3, 'PL': 3, 'UA': 3, 'RO': 3, 'CZ': 3, 'HU': 3, 'BG': 3, 'SK': 3, 'HR': 3, 'RS': 3, 'SI': 3, 'LT': 3, 'LV': 3, 'EE': 3,
  'NG': 4, 'ZA': 4, 'EG': 4, 'KE': 4, 'GH': 4, 'TZ': 4, 'MA': 4, 'DZ': 4, 'ET': 4, 'UG': 4,
  'BR': 5, 'MX': 5, 'AR': 5, 'CO': 5, 'CL': 5, 'PE': 5, 'VE': 5, 'EC': 5, 'CR': 5, 'PA': 5, 'JM': 5,
  'IN': 6, 'ID': 6, 'PK': 6, 'BD': 6, 'PH': 6, 'VN': 6, 'TH': 6, 'MY': 6, 'SA': 6, 'AE': 6, 'IL': 6, 'TR': 6, 'IR': 6,
  'AU': 7, 'NZ': 7, 'TW': 7, 'KR': 7, 'JP': 7, 'SG': 7,
  'CN': 8, 'MO': 8, 'HK': 8,
};

export const getRegionFromCountry = (countryCode) => REGION_MAP[countryCode?.toUpperCase()] || 6;

const fetchUsersFromDB = async (limit = 1000, offset = 0) => {
  const query = `
    SELECT 
      u.user_id,
      u.user_name,
      u.user_email,
      u.user_gender,
      u.user_country,
      u.user_birthdate,
      u.user_registered,
      u.user_subscribed,
      u.user_verified,
      ud.first_name,
      ud.last_name,
      ud.age,
      ud.gender,
      ud.country,
      ud.city,
      COALESCE(vote_stats.total_votes, 0) as total_votes_cast,
      COALESCE(election_stats.total_elections, 0) as total_elections_created
    FROM users u
    LEFT JOIN votteryy_user_details ud ON u.user_id = ud.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as total_votes
      FROM votteryy_votes
      WHERE status = 'valid'
      GROUP BY user_id
    ) vote_stats ON u.user_id::text = vote_stats.user_id
    LEFT JOIN (
      SELECT creator_id, COUNT(*) as total_elections
      FROM votteryyy_elections
      GROUP BY creator_id
    ) election_stats ON u.user_id = election_stats.creator_id
    ORDER BY u.user_id
    LIMIT $1 OFFSET $2
  `;

  const result = await db.query(query, [limit, offset]);
  return result.rows;
};

const transformUserForShaped = (user) => {
  const country = user.country || user.user_country || 'UNKNOWN';
  const gender = user.gender || (user.user_gender === 1 ? 'male' : user.user_gender === 2 ? 'female' : 'unknown');
  
  let age = user.age || 0;
  if (!age && user.user_birthdate) {
    const birthYear = new Date(user.user_birthdate).getFullYear();
    age = new Date().getFullYear() - birthYear;
  }

  // Only return fields that exist in Shaped table schema
  return {
    user_id: String(user.user_id),
    user_name: user.user_name || user.first_name || '',
    age: parseInt(age) || 0,
    gender: gender,
    city: user.city || '',
    region: getRegionFromCountry(country),
    country: country,
    created_at: user.user_registered ? new Date(user.user_registered).toISOString() : new Date().toISOString(),
    is_verified: Boolean(user.user_verified),
    total_votes_cast: parseInt(user.total_votes_cast) || 0,
    subscription_status: user.user_subscribed ? 'subscribed' : 'free',
    total_elections_created: parseInt(user.total_elections_created) || 0,
  };
};

export const syncUsersToShaped = async (options = {}) => {
  const { fullSync = false, since = null } = options;
  const batchSize = config.sync.batchSize;
  let totalSynced = 0;
  let offset = 0;
  let hasMore = true;

  logger.info({ fullSync, since }, 'Starting user sync');

  try {
    while (hasMore) {
      const users = await fetchUsersFromDB(batchSize, offset);
      
      if (users.length === 0) {
        hasMore = false;
        break;
      }

      const transformedUsers = users.map(transformUserForShaped);
      await shapedClient.insertDataset(config.shaped.datasets.users, transformedUsers);

      totalSynced += users.length;
      offset += batchSize;

      logger.debug({ batchCount: users.length, totalSynced }, 'User batch synced');

      if (users.length < batchSize) hasMore = false;
    }

    logger.info({ totalSynced }, 'User sync completed');
    return { success: true, totalSynced };
  } catch (error) {
    logger.error({ error: error.message, totalSynced }, 'User sync failed');
    throw error;
  }
};

export const syncSingleUser = async (userId) => {
  const query = `
    SELECT 
      u.user_id, u.user_name, u.user_email, u.user_gender, u.user_country,
      u.user_birthdate, u.user_registered, u.user_subscribed, u.user_verified,
      ud.first_name, ud.last_name, ud.age, ud.gender, ud.country, ud.city,
      COALESCE(vote_stats.total_votes, 0) as total_votes_cast,
      COALESCE(election_stats.total_elections, 0) as total_elections_created
    FROM users u
    LEFT JOIN votteryy_user_details ud ON u.user_id = ud.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as total_votes FROM votteryy_votes 
      WHERE user_id = $1::text AND status = 'valid' GROUP BY user_id
    ) vote_stats ON u.user_id::text = vote_stats.user_id
    LEFT JOIN (
      SELECT creator_id, COUNT(*) as total_elections FROM votteryyy_elections 
      WHERE creator_id = $1 GROUP BY creator_id
    ) election_stats ON u.user_id = election_stats.creator_id
    WHERE u.user_id = $1
  `;

  const result = await db.query(query, [userId]);
  
  if (result.rows.length === 0) {
    logger.warn({ userId }, 'User not found for sync');
    return { success: false, reason: 'User not found' };
  }

  const transformedUser = transformUserForShaped(result.rows[0]);
  await shapedClient.insertDataset(config.shaped.datasets.users, [transformedUser]);

  logger.debug({ userId }, 'Single user synced');
  return { success: true, user: transformedUser };
};

export default { syncUsersToShaped, syncSingleUser, getRegionFromCountry, REGION_MAP };
/**
 * Configuration - Recommendation Service
 */

import dotenv from 'dotenv';
dotenv.config();

const config = {
  // Server
  port: process.env.PORT || 3008,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Server object (for logger.js compatibility)
  server: {
    port: process.env.PORT || 3008,
    env: process.env.NODE_ENV || 'development',
  },

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'vottery',
    user: process.env.DB_USER || 'vottery_user',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },

  // Shaped AI
  shaped: {
    apiKey: process.env.SHAPED_API_KEY || '',
    apiKeyReadOnly: process.env.SHAPED_API_KEY_READ_ONLY || '',
    baseUrl: process.env.SHAPED_API_BASE_URL || 'https://api.shaped.ai/v2',
    
    engines: {
      electionsForYou: process.env.SHAPED_ENGINE_ELECTIONS || 'vottery_elections_for_you',
    },

    models: {
      electionsForYou: process.env.SHAPED_MODEL_ELECTIONS_FOR_YOU || 'vottery_elections_for_you',
      similarElections: process.env.SHAPED_MODEL_SIMILAR_ELECTIONS || 'vottery_similar_elections',
      trendingElections: process.env.SHAPED_MODEL_TRENDING_ELECTIONS || 'vottery_trending_elections',
      audienceMatching: process.env.SHAPED_MODEL_AUDIENCE_MATCHING || 'vottery_audience_matching',
    },

    datasets: {
      users: process.env.SHAPED_DATASET_USERS || 'vottery_users',
      elections: process.env.SHAPED_DATASET_ELECTIONS || 'vottery_elections',
      events: process.env.SHAPED_DATASET_EVENTS || 'vottery_events',
    },
  },

  sync: {
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 1000,
    intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 15,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
// /**
//  * Configuration - Recommendation Service
//  */

// import dotenv from 'dotenv';
// dotenv.config();

// const config = {
//   // Server
//   port: process.env.PORT || 3008,
//   nodeEnv: process.env.NODE_ENV || 'development',

//   // Database
//   database: {
//     host: process.env.DB_HOST || 'localhost',
//     port: parseInt(process.env.DB_PORT) || 5432,
//     name: process.env.DB_NAME || 'vottery',
//     user: process.env.DB_USER || 'vottery_user',
//     password: process.env.DB_PASSWORD || '',
//     ssl: process.env.DB_SSL === 'true',
//   },

//   // Shaped AI
//   shaped: {
//     apiKey: process.env.SHAPED_API_KEY || '',
//     apiKeyReadOnly: process.env.SHAPED_API_KEY_READ_ONLY || '',
//     baseUrl: process.env.SHAPED_API_BASE_URL || 'https://api.shaped.ai/v2',
    
//     // Engine name (must match what's in Shaped console)
//     engines: {
//       electionsForYou: process.env.SHAPED_ENGINE_ELECTIONS || 'vottery_elections_for_you',
//     },

//     // Model names (legacy - kept for backward compatibility)
//     models: {
//       electionsForYou: process.env.SHAPED_MODEL_ELECTIONS_FOR_YOU || 'vottery_elections_for_you',
//       similarElections: process.env.SHAPED_MODEL_SIMILAR_ELECTIONS || 'vottery_similar_elections',
//       trendingElections: process.env.SHAPED_MODEL_TRENDING_ELECTIONS || 'vottery_trending_elections',
//       audienceMatching: process.env.SHAPED_MODEL_AUDIENCE_MATCHING || 'vottery_audience_matching',
//     },

//     // Dataset/Table names
//     datasets: {
//       users: process.env.SHAPED_DATASET_USERS || 'vottery_users',
//       elections: process.env.SHAPED_DATASET_ELECTIONS || 'vottery_elections',
//       events: process.env.SHAPED_DATASET_EVENTS || 'vottery_events',
//     },
//   },

//   // Sync settings
//   sync: {
//     batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 1000,
//     intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 15,
//   },

//   // Logging
//   logging: {
//     level: process.env.LOG_LEVEL || 'info',
//   },
// };

// export default config;
// /**
//  * Configuration Module for Recommendation Service
//  */

// import 'dotenv/config';

// const config = {
//   server: {
//     port: parseInt(process.env.PORT, 10) || 3007,
//     env: process.env.NODE_ENV || 'development',
//   },

//   database: {
//     host: process.env.DB_HOST || 'localhost',
//     port: parseInt(process.env.DB_PORT, 10) || 5432,
//     name: process.env.DB_NAME || 'vottery',
//     user: process.env.DB_USER || 'vottery_user',
//     password: process.env.DB_PASSWORD || '',
//   },

//   shaped: {
//     apiKey: process.env.SHAPED_API_KEY,
//     apiKeyReadOnly: process.env.SHAPED_API_KEY_READ_ONLY,
//     baseUrl: process.env.SHAPED_API_BASE_URL || 'https://api.shaped.ai/v1',
    
//     models: {
//       electionsForYou: process.env.SHAPED_MODEL_ELECTIONS_FOR_YOU || 'vottery_elections_for_you',
//       similarElections: process.env.SHAPED_MODEL_SIMILAR_ELECTIONS || 'vottery_similar_elections',
//       trendingElections: process.env.SHAPED_MODEL_TRENDING_ELECTIONS || 'vottery_trending_elections',
//       audienceMatching: process.env.SHAPED_MODEL_AUDIENCE_MATCHING || 'vottery_audience_matching',
//     },

//     datasets: {
//       users: process.env.SHAPED_DATASET_USERS || 'vottery_users',
//       elections: process.env.SHAPED_DATASET_ELECTIONS || 'vottery_elections',
//       events: process.env.SHAPED_DATASET_EVENTS || 'vottery_events',
//     },
//   },

//   sync: {
//     batchSize: parseInt(process.env.SYNC_BATCH_SIZE, 10) || 1000,
//     intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 15,
//   },

//   logging: {
//     level: process.env.LOG_LEVEL || 'info',
//   },
// };

// export default config;
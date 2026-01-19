/**
 * Database Utility
 * PostgreSQL connection pool with SSL support
 */

import pg from 'pg';
import config from '../config/index.js';
import logger from './logger.js';

const { Pool } = pg;

// SSL configuration for production databases
const sslConfig = config.server.env === 'production' || process.env.DB_SSL === 'true'
  ? {
      ssl: {
        rejectUnauthorized: false, // Set to true in production with proper certs
      },
    }
  : {};

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ...sslConfig,
});

pool.on('error', (err) => {
  logger.error({ error: err.message }, 'Unexpected database error');
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

const db = {
  query: async (text, params) => {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug({ duration, rows: result.rowCount }, 'Database query executed');
      return result;
    } catch (error) {
      logger.error({ error: error.message, query: text.substring(0, 100) }, 'Database query failed');
      throw error;
    }
  },

  checkConnection: async () => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Database connection check failed');
      return false;
    }
  },

  close: async () => {
    await pool.end();
    logger.info('Database pool closed');
  },

  getPool: () => pool,
};

export default db;
 /**
//  * Database Connection Utility
//  * PostgreSQL connection pool
//  */

// import pg from 'pg';
// //import config from '../config/config.js';
// import logger from './logger.js';
// import config from '../config/index.js';

// const { Pool } = pg;

// const pool = new Pool({
//   host: config.database.host,
//   port: config.database.port,
//   database: config.database.name,
//   user: config.database.user,
//   password: config.database.password,
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 2000,
// });

// pool.on('connect', () => {
//   logger.debug('Database connection established');
// });

// pool.on('error', (err) => {
//   logger.error({ error: err.message }, 'Database pool error');
// });

// export const query = async (text, params) => {
//   const start = Date.now();
//   try {
//     const result = await pool.query(text, params);
//     const duration = Date.now() - start;
//     logger.debug({ query: text.substring(0, 100), duration, rows: result.rowCount }, 'Query executed');
//     return result;
//   } catch (error) {
//     logger.error({ query: text.substring(0, 100), error: error.message }, 'Query error');
//     throw error;
//   }
// };

// export const getClient = async () => {
//   return await pool.connect();
// };

// export const checkConnection = async () => {
//   try {
//     await pool.query('SELECT 1');
//     return true;
//   } catch (error) {
//     logger.error({ error: error.message }, 'Database connection check failed');
//     return false;
//   }
// };

// export const close = async () => {
//   await pool.end();
//   logger.info('Database pool closed');
// };

// export default { query, getClient, checkConnection, close, pool };
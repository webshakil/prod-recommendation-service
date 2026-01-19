/**
 * Logger Utility using Pino
 */

import pino from 'pino';
// import config from '../config';
//import config from '../config/config.js';
import config from '../config/index.js';  // ✅ Correct

const logger = pino({
  level: config.logging.level,
  transport: config.server.env === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    service: 'recommendation-service',
  },
});

export default logger;
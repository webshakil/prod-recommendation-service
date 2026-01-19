/**
 * Scheduled Sync Job
 * Can run as standalone or import into main app
 */

import 'dotenv/config';
import { Cron } from 'croner';
import { syncUsersToShaped, syncElectionsToShaped, forceFlush } from '../services/shaped/shaped.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

let lastUserSync = new Date();
let lastElectionSync = new Date();

const runUserSync = async () => {
  try {
    logger.info({ since: lastUserSync }, 'Running scheduled user sync');
    const result = await syncUsersToShaped({ fullSync: false, since: lastUserSync });
    lastUserSync = new Date();
    logger.info({ synced: result.totalSynced }, 'User sync completed');
    return result;
  } catch (error) {
    logger.error({ error: error.message }, 'User sync failed');
    throw error;
  }
};

const runElectionSync = async () => {
  try {
    logger.info({ since: lastElectionSync }, 'Running scheduled election sync');
    const result = await syncElectionsToShaped({ fullSync: false, since: lastElectionSync });
    lastElectionSync = new Date();
    logger.info({ synced: result.totalSynced }, 'Election sync completed');
    return result;
  } catch (error) {
    logger.error({ error: error.message }, 'Election sync failed');
    throw error;
  }
};

const runEventFlush = async () => {
  try {
    await forceFlush();
    logger.debug('Event buffer flushed');
  } catch (error) {
    logger.error({ error: error.message }, 'Event flush failed');
  }
};

export const startScheduledJobs = () => {
  const intervalMinutes = config.sync.intervalMinutes;
  
  logger.info({ syncInterval: `${intervalMinutes} minutes` }, 'Starting scheduled jobs');

  const userSyncJob = new Cron(`*/${intervalMinutes} * * * *`, () => {
    runUserSync().catch(err => logger.error({ error: err.message }, 'User sync cron error'));
  });

  const electionSyncJob = new Cron(`*/${intervalMinutes} * * * *`, () => {
    setTimeout(() => {
      runElectionSync().catch(err => logger.error({ error: err.message }, 'Election sync cron error'));
    }, 30000);
  });

  const eventFlushJob = new Cron('* * * * *', () => {
    runEventFlush().catch(err => logger.error({ error: err.message }, 'Event flush cron error'));
  });

  console.log(`\n📅 Scheduled Jobs Started (every ${intervalMinutes} min)\n`);

  return {
    userSyncJob, electionSyncJob, eventFlushJob,
    stop: () => {
      userSyncJob.stop();
      electionSyncJob.stop();
      eventFlushJob.stop();
      logger.info('Scheduled jobs stopped');
    },
  };
};

export const stopScheduledJobs = (jobs) => jobs?.stop?.();

if (import.meta.url === `file://${process.argv[1]}`) {
  const jobs = startScheduledJobs();
  
  process.on('SIGTERM', () => { stopScheduledJobs(jobs); process.exit(0); });
  process.on('SIGINT', () => { stopScheduledJobs(jobs); process.exit(0); });

  console.log('Running initial sync...');
  Promise.all([runUserSync(), runElectionSync()])
    .then(() => console.log('Initial sync done. Scheduler running.'))
    .catch(err => console.error('Initial sync failed:', err.message));
}

export default { startScheduledJobs, stopScheduledJobs, runUserSync, runElectionSync, runEventFlush };
/**
 * Initial Sync Job
 * Run: node src/jobs/initialSync.js
 */

import 'dotenv/config';
import { syncUsersToShaped, syncElectionsToShaped, batchTrackEvents, EVENT_TYPES } from '../services/shaped/index.js';
import db from '../utils/database.js';
import logger from '../utils/logger.js';

const syncHistoricalVotes = async () => {
  console.log('  Fetching historical votes...');
  
  try {
    const query = `
      SELECT user_id, election_id, created_at 
      FROM votteryy_votes 
      WHERE status = 'valid'
      ORDER BY created_at
    `;
    const result = await db.query(query);
    console.log(`  Found ${result.rows.length} historical votes`);
    
    if (result.rows.length === 0) return { synced: 0 };

    const events = result.rows.map(vote => ({
      userId: String(vote.user_id),
      electionId: String(vote.election_id),
      eventType: EVENT_TYPES.VOTE_CAST,
      metadata: { action: 'vote_cast', historical: true },
    }));

    await batchTrackEvents(events);
    return { synced: events.length };
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.log('  No votes table - skipping');
      return { synced: 0, skipped: true };
    }
    throw error;
  }
};

const runInitialSync = async () => {
  console.log('\n🔄 Starting Initial Data Sync...\n');
  
  const results = { startTime: new Date(), users: null, elections: null, votes: null, errors: [] };

  try {
    const dbConnected = await db.checkConnection();
    if (!dbConnected) throw new Error('Database connection failed');
    console.log('✓ Database connected\n');

    console.log('📋 Step 1/3: Syncing Users...');
    try {
      results.users = await syncUsersToShaped({ fullSync: true });
      console.log(`  ✓ Synced ${results.users.totalSynced || 0} users\n`);
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      results.errors.push({ step: 'users', error: error.message });
    }

    console.log('🗳️  Step 2/3: Syncing Elections...');
    try {
      results.elections = await syncElectionsToShaped({ fullSync: true });
      console.log(`  ✓ Synced ${results.elections.totalSynced || 0} elections\n`);
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      results.errors.push({ step: 'elections', error: error.message });
    }

    console.log('📊 Step 3/3: Syncing Vote Events...');
    try {
      results.votes = await syncHistoricalVotes();
      console.log(`  ✓ Synced ${results.votes.synced || 0} events\n`);
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      results.errors.push({ step: 'votes', error: error.message });
    }

    results.endTime = new Date();
    const duration = (results.endTime - results.startTime) / 1000;

    console.log('═══════════════════════════════════════════');
    console.log(`  Users:     ${results.users?.totalSynced || 0}`);
    console.log(`  Elections: ${results.elections?.totalSynced || 0}`);
    console.log(`  Events:    ${results.votes?.synced || 0}`);
    console.log(`  Duration:  ${duration.toFixed(2)}s`);
    console.log(`  Errors:    ${results.errors.length}`);
    console.log('═══════════════════════════════════════════\n');

    if (results.errors.length > 0) {
      console.log('⚠️  Errors:', results.errors.map(e => `${e.step}: ${e.error}`).join(', '));
    }

    console.log('✅ Initial sync completed!\n');
    console.log('Next: npm run model:status\n');

    return results;
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    logger.error({ error: error.message }, 'Initial sync failed');
    throw error;
  } finally {
    await db.close();
  }
};

runInitialSync().then(() => process.exit(0)).catch(() => process.exit(1));
/**
 * Check Model Status Job
 * Run: node src/jobs/checkModelStatus.js
 */

import 'dotenv/config';
import { shapedClient } from '../services/shaped/shapedClient.js';
import config from '../config/config.js';

const COLORS = {
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m', reset: '\x1b[0m',
};

const colorStatus = (status) => {
  const colorMap = { ACTIVE: COLORS.green, TRAINING: COLORS.yellow, DEPLOYING: COLORS.yellow, FETCHING: COLORS.cyan, SCHEDULING: COLORS.cyan };
  return `${colorMap[status] || COLORS.red}${status}${COLORS.reset}`;
};

const checkModelStatus = async () => {
  console.log('\n📊 Checking Shaped AI Status...\n');

  const modelNames = [
    { name: 'Elections For You', key: config.shaped.models.electionsForYou },
    { name: 'Similar Elections', key: config.shaped.models.similarElections },
    { name: 'Trending Elections', key: config.shaped.models.trendingElections },
    { name: 'Audience Matching', key: config.shaped.models.audienceMatching },
  ];

  const results = [];

  console.log('Model Name               │ Status');
  console.log('─────────────────────────┼──────────────');

  for (const { name, key } of modelNames) {
    try {
      const model = await shapedClient.getModel(key);
      const status = model.status || 'UNKNOWN';
      results.push({ name, status, success: true });
      console.log(`${name.padEnd(24)} │ ${colorStatus(status)}`);
    } catch {
      results.push({ name, status: 'NOT FOUND', success: false });
      console.log(`${name.padEnd(24)} │ ${COLORS.red}NOT FOUND${COLORS.reset}`);
    }
  }

  console.log('─────────────────────────┴──────────────\n');

  const activeCount = results.filter(r => r.status === 'ACTIVE').length;
  const trainingCount = results.filter(r => ['TRAINING', 'FETCHING', 'SCHEDULING', 'DEPLOYING'].includes(r.status)).length;

  console.log(`✅ Active: ${activeCount}/${modelNames.length}`);
  console.log(`⏳ Training: ${trainingCount}/${modelNames.length}`);

  if (activeCount === modelNames.length) {
    console.log('\n🎉 All models ACTIVE! Service ready.\n');
  } else if (trainingCount > 0) {
    console.log('\n⏳ Models training (30min - few hours). Run again to check.\n');
  } else {
    console.log('\n⚠️  Models not found. Run: npm run model:create\n');
  }

  return results;
};

const main = async () => {
  try {
    console.log('🔌 Testing Shaped AI connection...');
    const healthy = await shapedClient.healthCheck();
    
    if (!healthy) {
      console.log('\n❌ Cannot connect to Shaped AI. Check API key.\n');
      process.exit(1);
    }
    console.log('✓ Connected\n');

    await checkModelStatus();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
};

main().then(() => process.exit(0)).catch(() => process.exit(1));
/**
 * Create Models Job
 * Run: node src/jobs/createModels.js
 */

import 'dotenv/config';
import { shapedClient } from '../services/shaped/shapedClient.js';
import { getAllModelConfigs, getDatasetConfigs } from '../services/shaped/modelDefinitions.js';
import logger from '../utils/logger.js';

const createDatasetsAndModels = async () => {
  console.log('\n🚀 Starting Shaped AI Setup...\n');

  try {
    console.log('📦 Creating Datasets...\n');
    const datasetConfigs = getDatasetConfigs();

    for (const dataset of datasetConfigs) {
      console.log(`  Creating dataset: ${dataset.name}`);
      try {
        const result = await shapedClient.createDataset({ name: dataset.name, schema_type: dataset.schema_type });
        console.log(result.exists ? `  ✓ Dataset "${dataset.name}" already exists` : `  ✓ Dataset "${dataset.name}" created`);
      } catch (error) {
        console.log(`  ✗ Failed: ${error.message}`);
      }
    }

    console.log('\n⏳ Waiting for datasets...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🤖 Creating Models...\n');
    const modelConfigs = getAllModelConfigs();

    for (const { name, config } of modelConfigs) {
      console.log(`  Creating model: ${name}`);
      try {
        const result = await shapedClient.createModel(config);
        console.log(result.exists ? `  ✓ Model "${name}" already exists` : `  ✓ Model "${name}" created - Training started`);
      } catch (error) {
        console.log(`  ✗ Failed: ${error.message}`);
      }
    }

    console.log('\n✅ Shaped AI Setup Complete!\n');
    console.log('Next: npm run sync:initial && npm run model:status\n');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    logger.error({ error: error.message }, 'Create models job failed');
    process.exit(1);
  }
};

createDatasetsAndModels().then(() => process.exit(0)).catch(() => process.exit(1));
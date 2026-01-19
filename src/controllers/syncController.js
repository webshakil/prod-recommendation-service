/**
 * Sync Controller
 */

import * as shaped from '../services/shaped/index.js';
import { getDatasetConfigs, getAllModelConfigs } from '../services/shaped/modelDefinitions.js';
import logger from '../utils/logger.js';

export const syncUsers = async (req, res) => {
  try {
    const { fullSync = false, since } = req.body;
    logger.info({ fullSync, since }, 'User sync initiated');
    const result = await shaped.syncUsersToShaped({
      fullSync,
      since: since ? new Date(since) : null,
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: syncUsers');
    res.status(500).json({ success: false, error: 'Failed to sync users' });
  }
};

export const syncSingleUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const result = await shaped.syncSingleUser(userId);
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: syncSingleUser');
    res.status(500).json({ success: false, error: 'Failed to sync user' });
  }
};

export const syncElections = async (req, res) => {
  try {
    const { fullSync = false, since, status } = req.body;
    logger.info({ fullSync, since, status }, 'Election sync initiated');
    const result = await shaped.syncElectionsToShaped({
      fullSync,
      since: since ? new Date(since) : null,
      status,
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: syncElections');
    res.status(500).json({ success: false, error: 'Failed to sync elections' });
  }
};

export const syncSingleElection = async (req, res) => {
  try {
    const { electionId } = req.params;
    if (!electionId) {
      return res.status(400).json({ success: false, error: 'electionId is required' });
    }
    const result = await shaped.syncSingleElection(electionId);
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: syncSingleElection');
    res.status(500).json({ success: false, error: 'Failed to sync election' });
  }
};

/**
 * Sync all votes to Shaped
 */
export const syncVotes = async (req, res) => {
  try {
    const { includeParticipation = false, since } = req.body;
    logger.info({ includeParticipation, since }, 'Vote sync initiated');
    
    const result = await shaped.syncAllVotesToShaped({
      includeParticipation,
      since: since ? new Date(since) : null,
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: syncVotes');
    res.status(500).json({ success: false, error: 'Failed to sync votes' });
  }
};

/**
 * Get vote counts from database
 */
export const getVoteCounts = async (req, res) => {
  try {
    const counts = await shaped.getVoteCounts();
    res.json({ success: true, counts });
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getVoteCounts');
    res.status(500).json({ success: false, error: 'Failed to get vote counts' });
  }
};

export const runFullSync = async (req, res) => {
  try {
    const { createDatasets = true, createModels = true, syncVotes: shouldSyncVotes = true } = req.body;
    logger.info({ createDatasets, createModels, syncVotes: shouldSyncVotes }, 'Full sync initiated');

    const results = {
      datasets: [],
      users: null,
      elections: null,
      votes: null,
      models: [],
      startTime: new Date().toISOString(),
      endTime: null,
    };

    // Step 1: Create datasets FIRST (required before inserting data)
    if (createDatasets) {
      logger.info('Step 1: Creating datasets...');
      const datasetConfigs = getDatasetConfigs();

      for (const dataset of datasetConfigs) {
        try {
          logger.info({ name: dataset.name }, 'Creating dataset');
          const result = await shaped.shapedClient.createDataset({
            name: dataset.name,
            schema_type: 'CUSTOM',
          });
          results.datasets.push({
            name: dataset.name,
            status: result.exists ? 'already_exists' : 'created',
          });
        } catch (error) {
          logger.error({ name: dataset.name, error: error.message }, 'Dataset creation failed');
          results.datasets.push({
            name: dataset.name,
            status: 'error',
            error: error.message,
          });
        }
      }

      // Wait for datasets to be ready
      logger.info('Waiting for datasets to be ready...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Step 2: Sync users
    logger.info('Step 2: Syncing users...');
    try {
      results.users = await shaped.syncUsersToShaped({ fullSync: true });
    } catch (error) {
      logger.error({ error: error.message }, 'User sync failed');
      results.users = { success: false, error: error.message };
    }

    // Step 3: Sync elections
    logger.info('Step 3: Syncing elections...');
    try {
      results.elections = await shaped.syncElectionsToShaped({ fullSync: true });
    } catch (error) {
      logger.error({ error: error.message }, 'Election sync failed');
      results.elections = { success: false, error: error.message };
    }

    // Step 4: Sync votes
    if (shouldSyncVotes) {
      logger.info('Step 4: Syncing votes...');
      try {
        results.votes = await shaped.syncAllVotesToShaped({ includeParticipation: false });
      } catch (error) {
        logger.error({ error: error.message }, 'Vote sync failed');
        results.votes = { success: false, error: error.message };
      }
    } else {
      results.votes = { skipped: true };
    }

    // Step 5: Create models/engines
    if (createModels) {
      logger.info('Step 5: Creating models...');
      const modelConfigs = getAllModelConfigs();

      for (const { name, config } of modelConfigs) {
        try {
          logger.info({ name }, 'Creating model');
          const result = await shaped.shapedClient.createModel(config);
          results.models.push({
            name,
            status: result.exists ? 'already_exists' : 'created',
          });
        } catch (error) {
          logger.error({ name, error: error.message }, 'Model creation failed');
          results.models.push({
            name,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    results.endTime = new Date().toISOString();
    logger.info(results, 'Full sync completed');

    res.json({ success: true, results });
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: runFullSync');
    res.status(500).json({ success: false, error: 'Failed to run full sync', details: error.message });
  }
};

export const getSyncStatus = async (req, res) => {
  try {
    const activeElections = await shaped.getActiveElectionsCount();
    const shapedHealthy = await shaped.shapedClient.healthCheck();

    // Get vote counts
    let voteCounts = null;
    try {
      voteCounts = await shaped.getVoteCounts();
    } catch (e) {
      logger.warn({ error: e.message }, 'Failed to get vote counts');
    }

    // Get datasets and models from Shaped
    let datasets = [];
    let models = [];

    try {
      const datasetsResponse = await shaped.shapedClient.listDatasets();
      datasets = datasetsResponse.datasets || datasetsResponse.tables || datasetsResponse || [];
    } catch (e) {
      logger.warn({ error: e.message }, 'Failed to list datasets');
    }

    try {
      const modelsResponse = await shaped.shapedClient.listModels();
      models = modelsResponse.models || modelsResponse.engines || modelsResponse || [];
    } catch (e) {
      logger.warn({ error: e.message }, 'Failed to list models');
    }

    res.json({
      success: true,
      status: {
        shapedConnected: shapedHealthy,
        activeElections,
        voteCounts,
        datasets,
        models,
        lastSyncAt: null,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getSyncStatus');
    res.status(500).json({ success: false, error: 'Failed to get sync status' });
  }
};

export default {
  syncUsers,
  syncSingleUser,
  syncElections,
  syncSingleElection,
  syncVotes,
  getVoteCounts,
  runFullSync,
  getSyncStatus,
};
// /**
//  * Sync Controller
//  */

// import * as shaped from '../services/shaped/index.js';
// import { getDatasetConfigs, getAllModelConfigs } from '../services/shaped/modelDefinitions.js';
// import logger from '../utils/logger.js';

// export const syncUsers = async (req, res) => {
//   try {
//     const { fullSync = false, since } = req.body;
//     logger.info({ fullSync, since }, 'User sync initiated');
//     const result = await shaped.syncUsersToShaped({
//       fullSync,
//       since: since ? new Date(since) : null,
//     });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncUsers');
//     res.status(500).json({ success: false, error: 'Failed to sync users' });
//   }
// };

// export const syncSingleUser = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }
//     const result = await shaped.syncSingleUser(userId);
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncSingleUser');
//     res.status(500).json({ success: false, error: 'Failed to sync user' });
//   }
// };

// export const syncElections = async (req, res) => {
//   try {
//     const { fullSync = false, since, status } = req.body;
//     logger.info({ fullSync, since, status }, 'Election sync initiated');
//     const result = await shaped.syncElectionsToShaped({
//       fullSync,
//       since: since ? new Date(since) : null,
//       status,
//     });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncElections');
//     res.status(500).json({ success: false, error: 'Failed to sync elections' });
//   }
// };

// export const syncSingleElection = async (req, res) => {
//   try {
//     const { electionId } = req.params;
//     if (!electionId) {
//       return res.status(400).json({ success: false, error: 'electionId is required' });
//     }
//     const result = await shaped.syncSingleElection(electionId);
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncSingleElection');
//     res.status(500).json({ success: false, error: 'Failed to sync election' });
//   }
// };

// /**
//  * Sync all votes to Shaped
//  */
// export const syncVotes = async (req, res) => {
//   try {
//     const { includeParticipation = false, since } = req.body;
//     logger.info({ includeParticipation, since }, 'Vote sync initiated');
    
//     const result = await shaped.syncAllVotesToShaped({
//       includeParticipation,
//       since: since ? new Date(since) : null,
//     });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncVotes');
//     res.status(500).json({ success: false, error: 'Failed to sync votes' });
//   }
// };

// /**
//  * Get vote counts from database
//  */
// export const getVoteCounts = async (req, res) => {
//   try {
//     const counts = await shaped.getVoteCounts();
//     res.json({ success: true, counts });
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getVoteCounts');
//     res.status(500).json({ success: false, error: 'Failed to get vote counts' });
//   }
// };

// export const runFullSync = async (req, res) => {
//   try {
//     const { createDatasets = true, createModels = true, syncVotes: shouldSyncVotes = true } = req.body;
//     logger.info({ createDatasets, createModels, syncVotes: shouldSyncVotes }, 'Full sync initiated');

//     const results = {
//       datasets: [],
//       users: null,
//       elections: null,
//       votes: null,
//       models: [],
//       startTime: new Date().toISOString(),
//       endTime: null,
//     };

//     // Step 1: Create datasets FIRST (required before inserting data)
//     if (createDatasets) {
//       logger.info('Step 1: Creating datasets...');
//       const datasetConfigs = getDatasetConfigs();

//       for (const dataset of datasetConfigs) {
//         try {
//           logger.info({ name: dataset.name }, 'Creating dataset');
//           const result = await shaped.shapedClient.createDataset({
//             name: dataset.name,
//             schema_type: 'CUSTOM',
//           });
//           results.datasets.push({
//             name: dataset.name,
//             status: result.exists ? 'already_exists' : 'created',
//           });
//         } catch (error) {
//           logger.error({ name: dataset.name, error: error.message }, 'Dataset creation failed');
//           results.datasets.push({
//             name: dataset.name,
//             status: 'error',
//             error: error.message,
//           });
//         }
//       }

//       // Wait for datasets to be ready
//       logger.info('Waiting for datasets to be ready...');
//       await new Promise((resolve) => setTimeout(resolve, 2000));
//     }

//     // Step 2: Sync users
//     logger.info('Step 2: Syncing users...');
//     try {
//       results.users = await shaped.syncUsersToShaped({ fullSync: true });
//     } catch (error) {
//       logger.error({ error: error.message }, 'User sync failed');
//       results.users = { success: false, error: error.message };
//     }

//     // Step 3: Sync elections
//     logger.info('Step 3: Syncing elections...');
//     try {
//       results.elections = await shaped.syncElectionsToShaped({ fullSync: true });
//     } catch (error) {
//       logger.error({ error: error.message }, 'Election sync failed');
//       results.elections = { success: false, error: error.message };
//     }

//     // Step 4: Sync votes
//     if (shouldSyncVotes) {
//       logger.info('Step 4: Syncing votes...');
//       try {
//         results.votes = await shaped.syncAllVotesToShaped({ includeParticipation: false });
//       } catch (error) {
//         logger.error({ error: error.message }, 'Vote sync failed');
//         results.votes = { success: false, error: error.message };
//       }
//     } else {
//       results.votes = { skipped: true };
//     }

//     // Step 5: Create models/engines
//     if (createModels) {
//       logger.info('Step 5: Creating models...');
//       const modelConfigs = getAllModelConfigs();

//       for (const { name, config } of modelConfigs) {
//         try {
//           logger.info({ name }, 'Creating model');
//           const result = await shaped.shapedClient.createModel(config);
//           results.models.push({
//             name,
//             status: result.exists ? 'already_exists' : 'created',
//           });
//         } catch (error) {
//           logger.error({ name, error: error.message }, 'Model creation failed');
//           results.models.push({
//             name,
//             status: 'error',
//             error: error.message,
//           });
//         }
//       }
//     }

//     results.endTime = new Date().toISOString();
//     logger.info(results, 'Full sync completed');

//     res.json({ success: true, results });
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: runFullSync');
//     res.status(500).json({ success: false, error: 'Failed to run full sync', details: error.message });
//   }
// };

// export const getSyncStatus = async (req, res) => {
//   try {
//     const activeElections = await shaped.getActiveElectionsCount();
//     const shapedHealthy = await shaped.shapedClient.healthCheck();

//     // Get vote counts
//     let voteCounts = null;
//     try {
//       voteCounts = await shaped.getVoteCounts();
//     } catch (e) {
//       logger.warn({ error: e.message }, 'Failed to get vote counts');
//     }

//     // Get datasets and models from Shaped
//     let datasets = [];
//     let models = [];

//     try {
//       const datasetsResponse = await shaped.shapedClient.listDatasets();
//       datasets = datasetsResponse.datasets || datasetsResponse.tables || datasetsResponse || [];
//     } catch (e) {
//       logger.warn({ error: e.message }, 'Failed to list datasets');
//     }

//     try {
//       const modelsResponse = await shaped.shapedClient.listModels();
//       models = modelsResponse.models || modelsResponse.engines || modelsResponse || [];
//     } catch (e) {
//       logger.warn({ error: e.message }, 'Failed to list models');
//     }

//     res.json({
//       success: true,
//       status: {
//         shapedConnected: shapedHealthy,
//         activeElections,
//         voteCounts,
//         datasets,
//         models,
//         lastSyncAt: null,
//       },
//     });
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getSyncStatus');
//     res.status(500).json({ success: false, error: 'Failed to get sync status' });
//   }
// };

// export default {
//   syncUsers,
//   syncSingleUser,
//   syncElections,
//   syncSingleElection,
//   syncVotes,
//   getVoteCounts,
//   runFullSync,
//   getSyncStatus,
// };
// /**
//  * Sync Controller
//  */

// import * as shaped from '../services/shaped/index.js';
// import { getDatasetConfigs, getAllModelConfigs } from '../services/shaped/modelDefinitions.js';
// import logger from '../utils/logger.js';

// export const syncUsers = async (req, res) => {
//   try {
//     const { fullSync = false, since } = req.body;
//     logger.info({ fullSync, since }, 'User sync initiated');
//     const result = await shaped.syncUsersToShaped({
//       fullSync,
//       since: since ? new Date(since) : null,
//     });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncUsers');
//     res.status(500).json({ success: false, error: 'Failed to sync users' });
//   }
// };

// export const syncSingleUser = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }
//     const result = await shaped.syncSingleUser(userId);
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncSingleUser');
//     res.status(500).json({ success: false, error: 'Failed to sync user' });
//   }
// };

// export const syncElections = async (req, res) => {
//   try {
//     const { fullSync = false, since, status } = req.body;
//     logger.info({ fullSync, since, status }, 'Election sync initiated');
//     const result = await shaped.syncElectionsToShaped({
//       fullSync,
//       since: since ? new Date(since) : null,
//       status,
//     });
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncElections');
//     res.status(500).json({ success: false, error: 'Failed to sync elections' });
//   }
// };

// export const syncSingleElection = async (req, res) => {
//   try {
//     const { electionId } = req.params;
//     if (!electionId) {
//       return res.status(400).json({ success: false, error: 'electionId is required' });
//     }
//     const result = await shaped.syncSingleElection(electionId);
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncSingleElection');
//     res.status(500).json({ success: false, error: 'Failed to sync election' });
//   }
// };

// export const runFullSync = async (req, res) => {
//   try {
//     const { createDatasets = true, createModels = true } = req.body;
//     logger.info({ createDatasets, createModels }, 'Full sync initiated');

//     const results = {
//       datasets: [],
//       users: null,
//       elections: null,
//       models: [],
//       startTime: new Date().toISOString(),
//       endTime: null,
//     };

//     // Step 1: Create datasets FIRST (required before inserting data)
//     if (createDatasets) {
//       logger.info('Step 1: Creating datasets...');
//       const datasetConfigs = getDatasetConfigs();

//       for (const dataset of datasetConfigs) {
//         try {
//           logger.info({ name: dataset.name }, 'Creating dataset');
//           const result = await shaped.shapedClient.createDataset({
//             name: dataset.name,
//             schema_type: 'CUSTOM',
//           });
//           results.datasets.push({
//             name: dataset.name,
//             status: result.exists ? 'already_exists' : 'created',
//           });
//         } catch (error) {
//           logger.error({ name: dataset.name, error: error.message }, 'Dataset creation failed');
//           results.datasets.push({
//             name: dataset.name,
//             status: 'error',
//             error: error.message,
//           });
//         }
//       }

//       // Wait for datasets to be ready
//       logger.info('Waiting for datasets to be ready...');
//       await new Promise((resolve) => setTimeout(resolve, 2000));
//     }

//     // Step 2: Sync users
//     logger.info('Step 2: Syncing users...');
//     try {
//       results.users = await shaped.syncUsersToShaped({ fullSync: true });
//     } catch (error) {
//       logger.error({ error: error.message }, 'User sync failed');
//       results.users = { success: false, error: error.message };
//     }

//     // Step 3: Sync elections
//     logger.info('Step 3: Syncing elections...');
//     try {
//       results.elections = await shaped.syncElectionsToShaped({ fullSync: true });
//     } catch (error) {
//       logger.error({ error: error.message }, 'Election sync failed');
//       results.elections = { success: false, error: error.message };
//     }

//     // Step 4: Create models
//     if (createModels) {
//       logger.info('Step 4: Creating models...');
//       const modelConfigs = getAllModelConfigs();

//       for (const { name, config } of modelConfigs) {
//         try {
//           logger.info({ name }, 'Creating model');
//           const result = await shaped.shapedClient.createModel(config);
//           results.models.push({
//             name,
//             status: result.exists ? 'already_exists' : 'created',
//           });
//         } catch (error) {
//           logger.error({ name, error: error.message }, 'Model creation failed');
//           results.models.push({
//             name,
//             status: 'error',
//             error: error.message,
//           });
//         }
//       }
//     }

//     results.endTime = new Date().toISOString();
//     logger.info(results, 'Full sync completed');

//     res.json({ success: true, results });
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: runFullSync');
//     res.status(500).json({ success: false, error: 'Failed to run full sync', details: error.message });
//   }
// };

// export const getSyncStatus = async (req, res) => {
//   try {
//     const activeElections = await shaped.getActiveElectionsCount();
//     const shapedHealthy = await shaped.shapedClient.healthCheck();

//     // Get datasets and models from Shaped
//     let datasets = [];
//     let models = [];

//     try {
//       const datasetsResponse = await shaped.shapedClient.listDatasets();
//       datasets = datasetsResponse.datasets || datasetsResponse || [];
//     } catch (e) {
//       logger.warn({ error: e.message }, 'Failed to list datasets');
//     }

//     try {
//       const modelsResponse = await shaped.shapedClient.listModels();
//       models = modelsResponse.models || modelsResponse || [];
//     } catch (e) {
//       logger.warn({ error: e.message }, 'Failed to list models');
//     }

//     res.json({
//       success: true,
//       status: {
//         shapedConnected: shapedHealthy,
//         activeElections,
//         datasets,
//         models,
//         lastSyncAt: null,
//       },
//     });
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getSyncStatus');
//     res.status(500).json({ success: false, error: 'Failed to get sync status' });
//   }
// };

// export default {
//   syncUsers,
//   syncSingleUser,
//   syncElections,
//   syncSingleElection,
//   runFullSync,
//   getSyncStatus,
// };
// /**
//  * Sync Controller
//  */

// //import * as shaped from '../services/shaped/shaped.js';
// import * as shaped from '../services/shaped/index.js';
// import logger from '../utils/logger.js';

// export const syncUsers = async (req, res) => {
//   try {
//     const { fullSync = false, since } = req.body;
//     logger.info({ fullSync, since }, 'User sync initiated');

//     const result = await shaped.syncUsersToShaped({
//       fullSync,
//       since: since ? new Date(since) : null,
//     });

//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncUsers');
//     res.status(500).json({ success: false, error: 'Failed to sync users' });
//   }
// };

// export const syncSingleUser = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'userId is required' });
//     }

//     const result = await shaped.syncSingleUser(userId);
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncSingleUser');
//     res.status(500).json({ success: false, error: 'Failed to sync user' });
//   }
// };

// export const syncElections = async (req, res) => {
//   try {
//     const { fullSync = false, since, status } = req.body;
//     logger.info({ fullSync, since, status }, 'Election sync initiated');

//     const result = await shaped.syncElectionsToShaped({
//       fullSync,
//       since: since ? new Date(since) : null,
//       status,
//     });

//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncElections');
//     res.status(500).json({ success: false, error: 'Failed to sync elections' });
//   }
// };

// export const syncSingleElection = async (req, res) => {
//   try {
//     const { electionId } = req.params;

//     if (!electionId) {
//       return res.status(400).json({ success: false, error: 'electionId is required' });
//     }

//     const result = await shaped.syncSingleElection(electionId);
//     res.json(result);
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: syncSingleElection');
//     res.status(500).json({ success: false, error: 'Failed to sync election' });
//   }
// };

// export const runFullSync = async (req, res) => {
//   try {
//     logger.info('Full sync initiated');

//     const results = {
//       users: null,
//       elections: null,
//       startTime: new Date().toISOString(),
//       endTime: null,
//     };

//     results.users = await shaped.syncUsersToShaped({ fullSync: true });
//     results.elections = await shaped.syncElectionsToShaped({ fullSync: true });
//     results.endTime = new Date().toISOString();

//     logger.info(results, 'Full sync completed');
//     res.json({ success: true, results });
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: runFullSync');
//     res.status(500).json({ success: false, error: 'Failed to run full sync' });
//   }
// };

// export const getSyncStatus = async (req, res) => {
//   try {
//     const activeElections = await shaped.getActiveElectionsCount();
//     const shapedHealthy = await shaped.shapedClient.healthCheck();

//     res.json({
//       success: true,
//       status: { shapedConnected: shapedHealthy, activeElections, lastSyncAt: null },
//     });
//   } catch (error) {
//     logger.error({ error: error.message }, 'Controller error: getSyncStatus');
//     res.status(500).json({ success: false, error: 'Failed to get sync status' });
//   }
// };

// export default {
//   syncUsers, syncSingleUser, syncElections, syncSingleElection, runFullSync, getSyncStatus,
// };
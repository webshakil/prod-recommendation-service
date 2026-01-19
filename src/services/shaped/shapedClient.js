/**
 * Shaped AI API Client (v2)
 * Updated for Shaped AI v2 API - uses Tables instead of Datasets
 * 
 * API Documentation: https://docs.shaped.ai/docs/api/v2
 */

import axios from 'axios';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class ShapedClient {
  constructor(apiKey = null, options = {}) {
    this.apiKey = apiKey || config.shaped.apiKey;
    // Use v2 API base URL
    this.baseUrl = options.baseUrl || config.shaped.baseUrl || 'https://api.shaped.ai/v2';
    
    // Ensure we're using v2
    if (this.baseUrl.includes('/v1')) {
      this.baseUrl = this.baseUrl.replace('/v1', '/v2');
    }
    if (!this.baseUrl.includes('/v2')) {
      this.baseUrl = this.baseUrl.replace('api.shaped.ai', 'api.shaped.ai/v2');
    }

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      timeout: options.timeout || 30000,
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (reqConfig) => {
        logger.debug({
          method: reqConfig.method?.toUpperCase(),
          url: reqConfig.url,
          baseURL: reqConfig.baseURL,
        }, 'Shaped API Request');
        return reqConfig;
      },
      (error) => {
        logger.error({ error: error.message }, 'Shaped API Request Error');
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug({
          status: response.status,
          url: response.config.url,
        }, 'Shaped API Response');
        return response;
      },
      (error) => {
        logger.error({
          status: error.response?.status,
          message: error.response?.data?.message || error.response?.data?.error || error.message,
          url: error.config?.url,
          data: error.response?.data,
        }, 'Shaped API Response Error');
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // TABLE OPERATIONS (v2 API)
  // ============================================

  /**
   * Create a new table (v2 uses tables instead of datasets)
   * @param {Object} params - Table parameters
   * @param {string} params.name - Table name
   * @param {string} params.schema_type - Schema type (e.g., 'CUSTOM')
   * @returns {Promise<Object>}
   */
  async createTable(params) {
    try {
      const response = await this.client.post('/tables', params);
      logger.info({ name: params.name }, 'Table created');
      return response.data;
    } catch (error) {
      if (error.response?.status === 409 || error.response?.status === 422) {
        logger.info({ name: params.name }, 'Table already exists');
        return { exists: true, name: params.name };
      }
      throw error;
    }
  }

  /**
   * Alias for createTable (backward compatibility)
   */
  async createDataset(params) {
    return this.createTable(params);
  }

  /**
   * List all tables
   * @returns {Promise<Object>}
   */
  async listTables() {
    const response = await this.client.get('/tables');
    return response.data;
  }

  /**
   * Alias for listTables (backward compatibility)
   */
  async listDatasets() {
    return this.listTables();
  }

  /**
   * Get table details
   * @param {string} tableName - Table name
   * @returns {Promise<Object>}
   */
  async getTable(tableName) {
    const response = await this.client.get(`/tables/${tableName}`);
    return response.data;
  }

  /**
   * Alias for getTable (backward compatibility)
   */
  async getDataset(datasetName) {
    return this.getTable(datasetName);
  }

  /**
   * Delete a table
   * @param {string} tableName - Table name
   * @returns {Promise<Object>}
   */
  async deleteTable(tableName) {
    const response = await this.client.delete(`/tables/${tableName}`);
    logger.info({ name: tableName }, 'Table deleted');
    return response.data;
  }

  /**
   * Alias for deleteTable (backward compatibility)
   */
  async deleteDataset(datasetName) {
    return this.deleteTable(datasetName);
  }

  /**
   * Insert data into a table
   * @param {string} tableName - Table name
   * @param {Array} data - Array of records to insert
   * @returns {Promise<Object>}
   */
  async insertTable(tableName, data) {
    const response = await this.client.post(`/tables/${tableName}/insert`, {
      data: data,
    });
    logger.debug({ 
      name: tableName, 
      count: data.length 
    }, 'Data inserted into table');
    return response.data;
  }

  /**
   * Alias for insertTable (backward compatibility with old code)
   */
  async insertDataset(datasetName, data) {
    return this.insertTable(datasetName, data);
  }

  // ============================================
  // ENGINE OPERATIONS (v2 uses Engines instead of Models)
  // ============================================

  /**
   * Create a new engine
   * @param {Object} engineConfig - Engine configuration (YAML-like object)
   * @returns {Promise<Object>}
   */
  async createEngine(engineConfig) {
    try {
      const response = await this.client.post('/engines', engineConfig);
      logger.info({ name: engineConfig.name }, 'Engine created');
      return response.data;
    } catch (error) {
      if (error.response?.status === 409 || error.response?.status === 422) {
        logger.info({ name: engineConfig.name }, 'Engine already exists');
        return { exists: true, name: engineConfig.name };
      }
      throw error;
    }
  }

  /**
   * Alias for createEngine (backward compatibility)
   */
  async createModel(modelConfig) {
    return this.createEngine(modelConfig);
  }

  /**
   * List all engines
   * @returns {Promise<Object>}
   */
  async listEngines() {
    const response = await this.client.get('/engines');
    return response.data;
  }

  /**
   * Alias for listEngines (backward compatibility)
   */
  async listModels() {
    return this.listEngines();
  }

  /**
   * Get engine details
   * @param {string} engineName - Engine name
   * @returns {Promise<Object>}
   */
  async getEngine(engineName) {
    const response = await this.client.get(`/engines/${engineName}`);
    return response.data;
  }

  /**
   * Alias for getEngine (backward compatibility)
   */
  async getModel(modelName) {
    return this.getEngine(modelName);
  }

  /**
   * Delete an engine
   * @param {string} engineName - Engine name
   * @returns {Promise<Object>}
   */
  async deleteEngine(engineName) {
    const response = await this.client.delete(`/engines/${engineName}`);
    logger.info({ name: engineName }, 'Engine deleted');
    return response.data;
  }

  /**
   * Alias for deleteEngine (backward compatibility)
   */
  async deleteModel(modelName) {
    return this.deleteEngine(modelName);
  }

  /**
   * Get engine status
   * @param {string} engineName - Engine name
   * @returns {Promise<string>} Status
   */
  async getEngineStatus(engineName) {
    const engine = await this.getEngine(engineName);
    return engine.status;
  }

  /**
   * Alias for getEngineStatus (backward compatibility)
   */
  async getModelStatus(modelName) {
    return this.getEngineStatus(modelName);
  }

  // ============================================
  // QUERY OPERATIONS (v2 API)
  // ============================================

  /**
   * Query an engine for recommendations
   * @param {Object} params - Query parameters
   * @param {string} params.engineName - Engine name
   * @param {string} params.query - ShapedQL query
   * @param {Object} params.parameters - Query parameters
   * @returns {Promise<Object>}
   */
  async query(params) {
    const { engineName, query, parameters = {} } = params;

    const response = await this.client.post(`/engines/${engineName}/query`, {
      query,
      parameters,
    });
    return response.data;
  }

  /**
   * Get personalized recommendations for a user (v2 style)
   * @param {Object} params - Rank parameters
   * @param {string} params.engineName - Engine name (or modelName for backward compat)
   * @param {string} params.userId - User ID
   * @param {number} params.limit - Number of recommendations (default: 10)
   * @returns {Promise<Object>}
   */
  async rank(params) {
    const {
      engineName,
      modelName, // backward compatibility
      userId,
      limit = 10,
      returnMetadata = true,
      filterPredicate = null,
    } = params;

    const engine = engineName || modelName;

    // v2 uses ShapedQL queries
    let query = `SELECT * FROM similarity(limit=${limit}) LIMIT ${limit}`;
    
    const response = await this.client.post(`/engines/${engine}/query`, {
      query,
      parameters: {
        user_id: userId,
      },
      return_metadata: returnMetadata,
    });
    return response.data;
  }

  /**
   * Get similar items
   * @param {Object} params - Similar items parameters
   * @param {string} params.engineName - Engine name
   * @param {string} params.itemId - Item ID to find similar items for
   * @param {number} params.limit - Number of results
   * @returns {Promise<Object>}
   */
  async similarItems(params) {
    const {
      engineName,
      modelName, // backward compatibility
      itemId,
      limit = 10,
      returnMetadata = true,
    } = params;

    const engine = engineName || modelName;

    const response = await this.client.post(`/engines/${engine}/query`, {
      query: `SELECT * FROM similarity(input_item_id='${itemId}', limit=${limit}) LIMIT ${limit}`,
      parameters: {
        item_id: itemId,
      },
      return_metadata: returnMetadata,
    });

    return response.data;
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  /**
   * Check if Shaped API is reachable
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.listTables();
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Shaped API health check failed');
      return false;
    }
  }
}

// Singleton instance
const shapedClient = new ShapedClient();

// Named exports (for: import { shapedClient } from './shapedClient.js')
export { ShapedClient, shapedClient };

// Default export (for: import shapedClient from './shapedClient.js')
export default shapedClient;
// /**
//  * Shaped AI API Client
//  * Core client for interacting with Shaped AI REST API
//  * 
//  * API Documentation: https://docs.shaped.ai/docs/api/
//  */

// import axios from 'axios';
// import config from '../../config/index.js';
// import logger from '../../utils/logger.js';

// class ShapedClient {
//   constructor(apiKey = null, options = {}) {
//     this.apiKey = apiKey || config.shaped.apiKey;
//     this.baseUrl = options.baseUrl || config.shaped.baseUrl;

//     // Create axios instance with default config
//     this.client = axios.create({
//       baseURL: this.baseUrl,
//       headers: {
//         'Content-Type': 'application/json',
//         'x-api-key': this.apiKey,
//       },
//       timeout: options.timeout || 30000,
//     });

//     // Request interceptor for logging
//     this.client.interceptors.request.use(
//       (reqConfig) => {
//         logger.debug('Shaped API Request', {
//           method: reqConfig.method?.toUpperCase(),
//           url: reqConfig.url,
//         });
//         return reqConfig;
//       },
//       (error) => {
//         logger.error('Shaped API Request Error', { error: error.message });
//         return Promise.reject(error);
//       }
//     );

//     // Response interceptor for logging
//     this.client.interceptors.response.use(
//       (response) => {
//         logger.debug('Shaped API Response', {
//           status: response.status,
//           url: response.config.url,
//         });
//         return response;
//       },
//       (error) => {
//         logger.error('Shaped API Response Error', {
//           status: error.response?.status,
//           message: error.response?.data?.message || error.message,
//           url: error.config?.url,
//         });
//         return Promise.reject(error);
//       }
//     );
//   }

//   // ============================================
//   // DATASET OPERATIONS
//   // ============================================

//   async createDataset(params) {
//     try {
//       const response = await this.client.post('/datasets', params);
//       logger.info('Dataset created', { name: params.name });
//       return response.data;
//     } catch (error) {
//       if (error.response?.status === 409) {
//         logger.info('Dataset already exists', { name: params.name });
//         return { exists: true, name: params.name };
//       }
//       throw error;
//     }
//   }

//   async listDatasets() {
//     const response = await this.client.get('/datasets');
//     return response.data;
//   }

//   async getDataset(datasetName) {
//     const response = await this.client.get(`/datasets/${datasetName}`);
//     return response.data;
//   }

//   async deleteDataset(datasetName) {
//     const response = await this.client.delete(`/datasets/${datasetName}`);
//     logger.info('Dataset deleted', { name: datasetName });
//     return response.data;
//   }

//   async insertDataset(datasetName, data) {
//     const response = await this.client.post(`/datasets/${datasetName}/insert`, {
//       data,
//     });
//     logger.debug('Data inserted into dataset', {
//       name: datasetName,
//       count: data.length,
//     });
//     return response.data;
//   }

//   // ============================================
//   // MODEL OPERATIONS
//   // ============================================

//   async createModel(modelConfig) {
//     try {
//       const response = await this.client.post('/models', modelConfig);
//       logger.info('Model created', { name: modelConfig.model?.name });
//       return response.data;
//     } catch (error) {
//       if (error.response?.status === 409) {
//         logger.info('Model already exists', { name: modelConfig.model?.name });
//         return { exists: true, name: modelConfig.model?.name };
//       }
//       throw error;
//     }
//   }

//   async listModels() {
//     const response = await this.client.get('/models');
//     return response.data;
//   }

//   async getModel(modelName) {
//     const response = await this.client.get(`/models/${modelName}`);
//     return response.data;
//   }

//   async deleteModel(modelName) {
//     const response = await this.client.delete(`/models/${modelName}`);
//     logger.info('Model deleted', { name: modelName });
//     return response.data;
//   }

//   async getModelStatus(modelName) {
//     const model = await this.getModel(modelName);
//     return model.status;
//   }

//   // ============================================
//   // RANK / INFERENCE OPERATIONS
//   // ============================================

//   async rank(params) {
//     const {
//       modelName,
//       userId,
//       limit = 10,
//       returnMetadata = true,
//       filterPredicate = null,
//     } = params;

//     const body = {
//       user_id: userId,
//       limit,
//       return_metadata: returnMetadata,
//     };

//     if (filterPredicate) {
//       body.filter_predicate = filterPredicate;
//     }

//     const response = await this.client.post(
//       `/models/${modelName}/rank`,
//       body
//     );
//     return response.data;
//   }

//   async similarItems(params) {
//     const {
//       modelName,
//       itemId,
//       limit = 10,
//       returnMetadata = true,
//     } = params;

//     const response = await this.client.post(`/models/${modelName}/rank`, {
//       item_id: itemId,
//       limit,
//       return_metadata: returnMetadata,
//     });

//     return response.data;
//   }

//   async rankAttributeGrid(params) {
//     const {
//       modelName,
//       userId,
//       attributeName,
//       rowLimit = 5,
//       colLimit = 10,
//       returnMetadata = true,
//     } = params;

//     const response = await this.client.post(
//       `/models/${modelName}/rank_attribute_grid`,
//       {
//         user_id: userId,
//         attribute_name: attributeName,
//         row_limit: rowLimit,
//         col_limit: colLimit,
//         return_metadata: returnMetadata,
//       }
//     );

//     return response.data;
//   }

//   async retrieve(params) {
//     const {
//       modelName,
//       userId,
//       query = null,
//       filterPredicate = null,
//       limit = 10,
//     } = params;

//     const body = {
//       user_id: userId,
//       limit,
//     };

//     if (query) body.query = query;
//     if (filterPredicate) body.filter_predicate = filterPredicate;

//     const response = await this.client.post(
//       `/models/${modelName}/retrieve`,
//       body
//     );

//     return response.data;
//   }

//   // ============================================
//   // HEALTH CHECK
//   // ============================================

//   async healthCheck() {
//     try {
//       await this.listModels();
//       return true;
//     } catch (error) {
//       logger.error('Shaped API health check failed', {
//         error: error.message,
//       });
//       return false;
//     }
//   }
// }

// // Singleton instance
// const shapedClient = new ShapedClient();

// // Named exports (for: import { shapedClient } from './shapedClient.js')
// export { ShapedClient, shapedClient };

// // Default export (for: import shapedClient from './shapedClient.js')
// export default shapedClient;
// /**
//  * Shaped AI API Client
//  * Core client for interacting with Shaped AI REST API
//  * 
//  * API Documentation: https://docs.shaped.ai/docs/api/
//  */

// import axios from 'axios';
// import config from '../../config/index.js';
// import logger from '../../utils/logger.js';

// class ShapedClient {
//   constructor(apiKey = null, options = {}) {
//     this.apiKey = apiKey || config.shaped.apiKey;
//     this.baseUrl = options.baseUrl || config.shaped.baseUrl;

//     // Create axios instance with default config
//     this.client = axios.create({
//       baseURL: this.baseUrl,
//       headers: {
//         'Content-Type': 'application/json',
//         'x-api-key': this.apiKey,
//       },
//       timeout: options.timeout || 30000,
//     });

//     // Request interceptor for logging
//     this.client.interceptors.request.use(
//       (config) => {
//         logger.debug('Shaped API Request', {
//           method: config.method?.toUpperCase(),
//           url: config.url,
//         });
//         return config;
//       },
//       (error) => {
//         logger.error('Shaped API Request Error', { error: error.message });
//         return Promise.reject(error);
//       }
//     );

//     // Response interceptor for logging
//     this.client.interceptors.response.use(
//       (response) => {
//         logger.debug('Shaped API Response', {
//           status: response.status,
//           url: response.config.url,
//         });
//         return response;
//       },
//       (error) => {
//         logger.error('Shaped API Response Error', {
//           status: error.response?.status,
//           message: error.response?.data?.message || error.message,
//           url: error.config?.url,
//         });
//         return Promise.reject(error);
//       }
//     );
//   }

//   // ============================================
//   // DATASET OPERATIONS
//   // ============================================

//   async createDataset(params) {
//     try {
//       const response = await this.client.post('/datasets', params);
//       logger.info('Dataset created', { name: params.name });
//       return response.data;
//     } catch (error) {
//       if (error.response?.status === 409) {
//         logger.info('Dataset already exists', { name: params.name });
//         return { exists: true, name: params.name };
//       }
//       throw error;
//     }
//   }

//   async listDatasets() {
//     const response = await this.client.get('/datasets');
//     return response.data;
//   }

//   async getDataset(datasetName) {
//     const response = await this.client.get(`/datasets/${datasetName}`);
//     return response.data;
//   }

//   async deleteDataset(datasetName) {
//     const response = await this.client.delete(`/datasets/${datasetName}`);
//     logger.info('Dataset deleted', { name: datasetName });
//     return response.data;
//   }

//   async insertDataset(datasetName, data) {
//     const response = await this.client.post(`/datasets/${datasetName}/insert`, {
//       data,
//     });
//     logger.debug('Data inserted into dataset', {
//       name: datasetName,
//       count: data.length,
//     });
//     return response.data;
//   }

//   // ============================================
//   // MODEL OPERATIONS
//   // ============================================

//   async createModel(modelConfig) {
//     try {
//       const response = await this.client.post('/models', modelConfig);
//       logger.info('Model created', { name: modelConfig.model?.name });
//       return response.data;
//     } catch (error) {
//       if (error.response?.status === 409) {
//         logger.info('Model already exists', { name: modelConfig.model?.name });
//         return { exists: true, name: modelConfig.model?.name };
//       }
//       throw error;
//     }
//   }

//   async listModels() {
//     const response = await this.client.get('/models');
//     return response.data;
//   }

//   async getModel(modelName) {
//     const response = await this.client.get(`/models/${modelName}`);
//     return response.data;
//   }

//   async deleteModel(modelName) {
//     const response = await this.client.delete(`/models/${modelName}`);
//     logger.info('Model deleted', { name: modelName });
//     return response.data;
//   }

//   async getModelStatus(modelName) {
//     const model = await this.getModel(modelName);
//     return model.status;
//   }

//   // ============================================
//   // RANK / INFERENCE OPERATIONS
//   // ============================================

//   async rank(params) {
//     const {
//       modelName,
//       userId,
//       limit = 10,
//       returnMetadata = true,
//       filterPredicate = null,
//     } = params;

//     const body = {
//       user_id: userId,
//       limit,
//       return_metadata: returnMetadata,
//     };

//     if (filterPredicate) {
//       body.filter_predicate = filterPredicate;
//     }

//     const response = await this.client.post(
//       `/models/${modelName}/rank`,
//       body
//     );
//     return response.data;
//   }

//   async similarItems(params) {
//     const {
//       modelName,
//       itemId,
//       limit = 10,
//       returnMetadata = true,
//     } = params;

//     const response = await this.client.post(`/models/${modelName}/rank`, {
//       item_id: itemId,
//       limit,
//       return_metadata: returnMetadata,
//     });

//     return response.data;
//   }

//   async rankAttributeGrid(params) {
//     const {
//       modelName,
//       userId,
//       attributeName,
//       rowLimit = 5,
//       colLimit = 10,
//       returnMetadata = true,
//     } = params;

//     const response = await this.client.post(
//       `/models/${modelName}/rank_attribute_grid`,
//       {
//         user_id: userId,
//         attribute_name: attributeName,
//         row_limit: rowLimit,
//         col_limit: colLimit,
//         return_metadata: returnMetadata,
//       }
//     );

//     return response.data;
//   }

//   async retrieve(params) {
//     const {
//       modelName,
//       userId,
//       query = null,
//       filterPredicate = null,
//       limit = 10,
//     } = params;

//     const body = {
//       user_id: userId,
//       limit,
//     };

//     if (query) body.query = query;
//     if (filterPredicate) body.filter_predicate = filterPredicate;

//     const response = await this.client.post(
//       `/models/${modelName}/retrieve`,
//       body
//     );

//     return response.data;
//   }

//   // ============================================
//   // HEALTH CHECK
//   // ============================================

//   async healthCheck() {
//     try {
//       await this.listModels();
//       return true;
//     } catch (error) {
//       logger.error('Shaped API health check failed', {
//         error: error.message,
//       });
//       return false;
//     }
//   }
// }

// // Singleton instance
// const shapedClient = new ShapedClient();

// /**
//  * ES6 Exports
//  */
// export { ShapedClient };
// export default shapedClient;

// /**
//  * Shaped AI API Client
//  * Core client for interacting with Shaped AI REST API
//  * 
//  * API Documentation: https://docs.shaped.ai/docs/api/
//  */

// const axios = require('axios');
// const config = require('../../config');
// const logger = require('../../utils/logger');

// class ShapedClient {
//   constructor(apiKey = null, options = {}) {
//     this.apiKey = apiKey || config.shaped.apiKey;
//     this.baseUrl = options.baseUrl || config.shaped.baseUrl;
    
//     // Create axios instance with default config
//     this.client = axios.create({
//       baseURL: this.baseUrl,
//       headers: {
//         'Content-Type': 'application/json',
//         'x-api-key': this.apiKey,
//       },
//       timeout: options.timeout || 30000,
//     });

//     // Request interceptor for logging
//     this.client.interceptors.request.use(
//       (config) => {
//         logger.debug('Shaped API Request', {
//           method: config.method?.toUpperCase(),
//           url: config.url,
//         });
//         return config;
//       },
//       (error) => {
//         logger.error('Shaped API Request Error', { error: error.message });
//         return Promise.reject(error);
//       }
//     );

//     // Response interceptor for logging
//     this.client.interceptors.response.use(
//       (response) => {
//         logger.debug('Shaped API Response', {
//           status: response.status,
//           url: response.config.url,
//         });
//         return response;
//       },
//       (error) => {
//         logger.error('Shaped API Response Error', {
//           status: error.response?.status,
//           message: error.response?.data?.message || error.message,
//           url: error.config?.url,
//         });
//         return Promise.reject(error);
//       }
//     );
//   }

//   // ============================================
//   // DATASET OPERATIONS
//   // ============================================

//   /**
//    * Create a new dataset
//    * @param {Object} params - Dataset parameters
//    * @param {string} params.name - Dataset name
//    * @param {string} params.schema_type - Schema type (e.g., 'CUSTOM', 'MONGODB')
//    * @returns {Promise<Object>}
//    */
//   async createDataset(params) {
//     try {
//       const response = await this.client.post('/datasets', params);
//       logger.info('Dataset created', { name: params.name });
//       return response.data;
//     } catch (error) {
//       if (error.response?.status === 409) {
//         logger.info('Dataset already exists', { name: params.name });
//         return { exists: true, name: params.name };
//       }
//       throw error;
//     }
//   }

//   /**
//    * List all datasets
//    * @returns {Promise<Object>}
//    */
//   async listDatasets() {
//     const response = await this.client.get('/datasets');
//     return response.data;
//   }

//   /**
//    * Get dataset details
//    * @param {string} datasetName - Dataset name
//    * @returns {Promise<Object>}
//    */
//   async getDataset(datasetName) {
//     const response = await this.client.get(`/datasets/${datasetName}`);
//     return response.data;
//   }

//   /**
//    * Delete a dataset
//    * @param {string} datasetName - Dataset name
//    * @returns {Promise<Object>}
//    */
//   async deleteDataset(datasetName) {
//     const response = await this.client.delete(`/datasets/${datasetName}`);
//     logger.info('Dataset deleted', { name: datasetName });
//     return response.data;
//   }

//   /**
//    * Insert data into a dataset
//    * @param {string} datasetName - Dataset name
//    * @param {Array} data - Array of records to insert
//    * @returns {Promise<Object>}
//    */
//   async insertDataset(datasetName, data) {
//     const response = await this.client.post(`/datasets/${datasetName}/insert`, {
//       data: data,
//     });
//     logger.debug('Data inserted into dataset', { 
//       name: datasetName, 
//       count: data.length 
//     });
//     return response.data;
//   }

//   // ============================================
//   // MODEL OPERATIONS
//   // ============================================

//   /**
//    * Create a new model
//    * @param {Object} modelConfig - Model configuration (YAML-like object)
//    * @returns {Promise<Object>}
//    */
//   async createModel(modelConfig) {
//     try {
//       const response = await this.client.post('/models', modelConfig);
//       logger.info('Model created', { name: modelConfig.model?.name });
//       return response.data;
//     } catch (error) {
//       if (error.response?.status === 409) {
//         logger.info('Model already exists', { name: modelConfig.model?.name });
//         return { exists: true, name: modelConfig.model?.name };
//       }
//       throw error;
//     }
//   }

//   /**
//    * List all models
//    * @returns {Promise<Object>}
//    */
//   async listModels() {
//     const response = await this.client.get('/models');
//     return response.data;
//   }

//   /**
//    * Get model details
//    * @param {string} modelName - Model name
//    * @returns {Promise<Object>}
//    */
//   async getModel(modelName) {
//     const response = await this.client.get(`/models/${modelName}`);
//     return response.data;
//   }

//   /**
//    * Delete a model
//    * @param {string} modelName - Model name
//    * @returns {Promise<Object>}
//    */
//   async deleteModel(modelName) {
//     const response = await this.client.delete(`/models/${modelName}`);
//     logger.info('Model deleted', { name: modelName });
//     return response.data;
//   }

//   /**
//    * Get model status
//    * @param {string} modelName - Model name
//    * @returns {Promise<string>} Status: SCHEDULING, FETCHING, TRAINING, DEPLOYING, ACTIVE
//    */
//   async getModelStatus(modelName) {
//     const model = await this.getModel(modelName);
//     return model.status;
//   }

//   // ============================================
//   // RANK/INFERENCE OPERATIONS
//   // ============================================

//   /**
//    * Get personalized recommendations for a user
//    * @param {Object} params - Rank parameters
//    * @param {string} params.modelName - Model name
//    * @param {string} params.userId - User ID
//    * @param {number} params.limit - Number of recommendations (default: 10)
//    * @param {boolean} params.returnMetadata - Return item metadata (default: true)
//    * @param {string} params.filterPredicate - SQL-like filter (optional)
//    * @returns {Promise<Object>}
//    */
//   async rank(params) {
//     const {
//       modelName,
//       userId,
//       limit = 10,
//       returnMetadata = true,
//       filterPredicate = null,
//     } = params;

//     const body = {
//       user_id: userId,
//       limit,
//       return_metadata: returnMetadata,
//     };

//     if (filterPredicate) {
//       body.filter_predicate = filterPredicate;
//     }

//     const response = await this.client.post(`/models/${modelName}/rank`, body);
//     return response.data;
//   }

//   /**
//    * Get similar items
//    * @param {Object} params - Similar items parameters
//    * @param {string} params.modelName - Model name
//    * @param {string} params.itemId - Item ID to find similar items for
//    * @param {number} params.limit - Number of results
//    * @param {boolean} params.returnMetadata - Return item metadata
//    * @returns {Promise<Object>}
//    */
//   async similarItems(params) {
//     const {
//       modelName,
//       itemId,
//       limit = 10,
//       returnMetadata = true,
//     } = params;

//     const response = await this.client.post(`/models/${modelName}/rank`, {
//       item_id: itemId,
//       limit,
//       return_metadata: returnMetadata,
//     });
//     return response.data;
//   }

//   /**
//    * Get personalized grid recommendations (Netflix-style)
//    * @param {Object} params - Grid parameters
//    * @param {string} params.modelName - Model name
//    * @param {string} params.userId - User ID
//    * @param {string} params.attributeName - Attribute for rows (e.g., 'category')
//    * @param {number} params.rowLimit - Number of rows
//    * @param {number} params.colLimit - Number of items per row
//    * @returns {Promise<Object>}
//    */
//   async rankAttributeGrid(params) {
//     const {
//       modelName,
//       userId,
//       attributeName,
//       rowLimit = 5,
//       colLimit = 10,
//       returnMetadata = true,
//     } = params;

//     const response = await this.client.post(`/models/${modelName}/rank_attribute_grid`, {
//       user_id: userId,
//       attribute_name: attributeName,
//       row_limit: rowLimit,
//       col_limit: colLimit,
//       return_metadata: returnMetadata,
//     });
//     return response.data;
//   }

//   /**
//    * Retrieve items (without full ranking pipeline)
//    * @param {Object} params - Retrieve parameters
//    * @returns {Promise<Object>}
//    */
//   async retrieve(params) {
//     const {
//       modelName,
//       userId,
//       query = null,
//       filterPredicate = null,
//       limit = 10,
//     } = params;

//     const body = {
//       user_id: userId,
//       limit,
//     };

//     if (query) body.query = query;
//     if (filterPredicate) body.filter_predicate = filterPredicate;

//     const response = await this.client.post(`/models/${modelName}/retrieve`, body);
//     return response.data;
//   }

//   // ============================================
//   // HEALTH CHECK
//   // ============================================

//   /**
//    * Check if Shaped API is reachable
//    * @returns {Promise<boolean>}
//    */
//   async healthCheck() {
//     try {
//       await this.listModels();
//       return true;
//     } catch (error) {
//       logger.error('Shaped API health check failed', { error: error.message });
//       return false;
//     }
//   }
// }

// // Export singleton instance
// const shapedClient = new ShapedClient();

// module.exports = {
//   ShapedClient,
//   shapedClient,
// };
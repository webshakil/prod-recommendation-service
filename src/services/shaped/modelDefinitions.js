/**
 * Shaped AI Model Definitions
 */

//import config from '../../config/config.js';
import config from '../../config/index.js';
export const getElectionsForYouModel = () => ({
  model: { name: config.shaped.models.electionsForYou },
  connectors: [
    { type: 'Dataset', id: 'events', name: config.shaped.datasets.events },
    { type: 'Dataset', id: 'elections', name: config.shaped.datasets.elections },
    { type: 'Dataset', id: 'users', name: config.shaped.datasets.users },
  ],
  fetch: {
    events: `
      SELECT user_id, item_id, created_at,
        CAST(JSON_EXTRACT_STRING(document, '$.label') AS FLOAT) as label
      FROM events
      WHERE JSON_EXTRACT_STRING(document, '$.event_type') IN ('vote_cast', 'election_shared', 'election_saved', 'view_election', 'lottery_win')
    `,
    items: `
      SELECT item_id, JSON_EXTRACT_STRING(document, '$.title') as title,
        JSON_EXTRACT_STRING(document, '$.category') as category,
        JSON_EXTRACT_STRING(document, '$.voting_type') as voting_type,
        CAST(JSON_EXTRACT_STRING(document, '$.is_lotterized') AS BOOLEAN) as is_lotterized,
        CAST(JSON_EXTRACT_STRING(document, '$.prize_amount') AS FLOAT) as prize_amount,
        CAST(JSON_EXTRACT_STRING(document, '$.participation_fee') AS FLOAT) as participation_fee,
        JSON_EXTRACT_STRING(document, '$.status') as status,
        CAST(JSON_EXTRACT_STRING(document, '$.is_active') AS BOOLEAN) as is_active,
        JSON_EXTRACT_STRING(document, '$.created_at') as created_at
      FROM elections
    `,
    users: `
      SELECT user_id, JSON_EXTRACT_STRING(document, '$.country') as country,
        CAST(JSON_EXTRACT_STRING(document, '$.region') AS INTEGER) as region,
        JSON_EXTRACT_STRING(document, '$.gender') as gender,
        CAST(JSON_EXTRACT_STRING(document, '$.age') AS INTEGER) as age,
        JSON_EXTRACT_STRING(document, '$.subscription_status') as subscription_status
      FROM users
    `,
  },
});

export const getSimilarElectionsModel = () => ({
  model: { name: config.shaped.models.similarElections },
  connectors: [
    { type: 'Dataset', id: 'events', name: config.shaped.datasets.events },
    { type: 'Dataset', id: 'elections', name: config.shaped.datasets.elections },
  ],
  fetch: {
    events: `
      SELECT user_id, item_id, created_at,
        CAST(JSON_EXTRACT_STRING(document, '$.label') AS FLOAT) as label
      FROM events WHERE JSON_EXTRACT_STRING(document, '$.event_type') = 'vote_cast'
    `,
    items: `
      SELECT item_id, JSON_EXTRACT_STRING(document, '$.title') as title,
        JSON_EXTRACT_STRING(document, '$.description') as description,
        JSON_EXTRACT_STRING(document, '$.category') as category,
        JSON_EXTRACT_STRING(document, '$.voting_type') as voting_type,
        CAST(JSON_EXTRACT_STRING(document, '$.is_lotterized') AS BOOLEAN) as is_lotterized,
        JSON_EXTRACT_STRING(document, '$.status') as status,
        CAST(JSON_EXTRACT_STRING(document, '$.is_active') AS BOOLEAN) as is_active
      FROM elections
    `,
  },
});

export const getTrendingElectionsModel = () => ({
  model: { name: config.shaped.models.trendingElections },
  policy_configs: { scoring_policy: { policy_type: 'rising-popularity', time_window: 7 } },
  connectors: [
    { type: 'Dataset', id: 'events', name: config.shaped.datasets.events },
    { type: 'Dataset', id: 'elections', name: config.shaped.datasets.elections },
  ],
  fetch: {
    events: `
      SELECT user_id, item_id, 1 as label, created_at
      FROM events WHERE JSON_EXTRACT_STRING(document, '$.event_type') IN ('vote_cast', 'view_election')
    `,
    items: `
      SELECT item_id, JSON_EXTRACT_STRING(document, '$.title') as title,
        JSON_EXTRACT_STRING(document, '$.category') as category,
        CAST(JSON_EXTRACT_STRING(document, '$.is_lotterized') AS BOOLEAN) as is_lotterized,
        CAST(JSON_EXTRACT_STRING(document, '$.prize_amount') AS FLOAT) as prize_amount,
        JSON_EXTRACT_STRING(document, '$.status') as status,
        CAST(JSON_EXTRACT_STRING(document, '$.is_active') AS BOOLEAN) as is_active
      FROM elections
    `,
  },
});

export const getAudienceMatchingModel = () => ({
  model: { name: config.shaped.models.audienceMatching },
  connectors: [
    { type: 'Dataset', id: 'events', name: config.shaped.datasets.events },
    { type: 'Dataset', id: 'users', name: config.shaped.datasets.users },
  ],
  fetch: {
    events: `
      SELECT item_id as user_id, user_id as item_id, created_at,
        CAST(JSON_EXTRACT_STRING(document, '$.label') AS FLOAT) as label
      FROM events WHERE JSON_EXTRACT_STRING(document, '$.event_type') = 'vote_cast'
    `,
    items: `
      SELECT user_id as item_id, JSON_EXTRACT_STRING(document, '$.country') as country,
        CAST(JSON_EXTRACT_STRING(document, '$.region') AS INTEGER) as region,
        JSON_EXTRACT_STRING(document, '$.gender') as gender,
        CAST(JSON_EXTRACT_STRING(document, '$.age') AS INTEGER) as age
      FROM users
    `,
  },
});

export const getAllModelConfigs = () => [
  { name: 'Elections For You', config: getElectionsForYouModel() },
  { name: 'Similar Elections', config: getSimilarElectionsModel() },
  { name: 'Trending Elections', config: getTrendingElectionsModel() },
  { name: 'Audience Matching', config: getAudienceMatchingModel() },
];

export const getDatasetConfigs = () => [
  { name: config.shaped.datasets.users, schema_type: 'CUSTOM', description: 'Vottery users' },
  { name: config.shaped.datasets.elections, schema_type: 'CUSTOM', description: 'Elections' },
  { name: config.shaped.datasets.events, schema_type: 'CUSTOM', description: 'User events' },
];

export default { getAllModelConfigs, getDatasetConfigs };
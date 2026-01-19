/**
 * Shaped AI Services - Main Export
 */

import ShapedClient, { shapedClient } from './shapedClient.js';
import { EVENT_TYPES, getEventLabel, isPositiveEvent, isNegativeEvent } from './eventTypes.js';
import { syncUsersToShaped, syncSingleUser, getRegionFromCountry, REGION_MAP } from './userSync.js';
import { syncElectionsToShaped, syncSingleElection, getActiveElectionsCount, ELECTION_STATUS, VOTING_TYPES } from './electionSync.js';
import {
  syncAllVotesToShaped,
  syncRegularVotesToShaped,
  syncAnonymousVotesToShaped,
  syncParticipationToShaped,
  syncSingleVote,
  getVoteCounts
} from './voteSync.js';
import {
  trackEvent, trackVoteCast, trackElectionView, trackElectionShared, trackElectionSaved,
  trackElectionSkipped, trackLotteryWin, trackVerificationDone, trackResultsView,
  trackElectionCreated, batchTrackEvents, getBufferSize, forceFlush
} from './eventTracker.js';
import {
  getElectionsForYou, getSimilarElections, getTrendingElections,
  getAudienceForElection, getLotterizedPicks, getElectionsByCategory
} from './recommendations.js';
import { getAllModelConfigs, getDatasetConfigs } from './modelDefinitions.js';

export {
  // Client
  ShapedClient, 
  shapedClient,
  
  // Event Types
  EVENT_TYPES, 
  getEventLabel, 
  isPositiveEvent, 
  isNegativeEvent,
  
  // User Sync
  syncUsersToShaped, 
  syncSingleUser, 
  getRegionFromCountry, 
  REGION_MAP,
  
  // Election Sync
  syncElectionsToShaped, 
  syncSingleElection, 
  getActiveElectionsCount, 
  ELECTION_STATUS, 
  VOTING_TYPES,
  
  // Vote Sync (NEW)
  syncAllVotesToShaped,
  syncRegularVotesToShaped,
  syncAnonymousVotesToShaped,
  syncParticipationToShaped,
  syncSingleVote,
  getVoteCounts,
  
  // Event Tracking
  trackEvent, 
  trackVoteCast, 
  trackElectionView, 
  trackElectionShared, 
  trackElectionSaved,
  trackElectionSkipped, 
  trackLotteryWin, 
  trackVerificationDone, 
  trackResultsView,
  trackElectionCreated, 
  batchTrackEvents, 
  getBufferSize, 
  forceFlush,
  
  // Recommendations
  getElectionsForYou, 
  getSimilarElections, 
  getTrendingElections,
  getAudienceForElection, 
  getLotterizedPicks, 
  getElectionsByCategory,
  
  // Model Configs
  getAllModelConfigs, 
  getDatasetConfigs,
};

export default {
  // Client
  ShapedClient, 
  shapedClient,
  
  // Event Types
  EVENT_TYPES, 
  getEventLabel, 
  isPositiveEvent, 
  isNegativeEvent,
  
  // User Sync
  syncUsersToShaped, 
  syncSingleUser, 
  getRegionFromCountry, 
  REGION_MAP,
  
  // Election Sync
  syncElectionsToShaped, 
  syncSingleElection, 
  getActiveElectionsCount, 
  ELECTION_STATUS, 
  VOTING_TYPES,
  
  // Vote Sync (NEW)
  syncAllVotesToShaped,
  syncRegularVotesToShaped,
  syncAnonymousVotesToShaped,
  syncParticipationToShaped,
  syncSingleVote,
  getVoteCounts,
  
  // Event Tracking
  trackEvent, 
  trackVoteCast, 
  trackElectionView, 
  trackElectionShared, 
  trackElectionSaved,
  trackElectionSkipped, 
  trackLotteryWin, 
  trackVerificationDone, 
  trackResultsView,
  trackElectionCreated, 
  batchTrackEvents, 
  getBufferSize, 
  forceFlush,
  
  // Recommendations
  getElectionsForYou, 
  getSimilarElections, 
  getTrendingElections,
  getAudienceForElection, 
  getLotterizedPicks, 
  getElectionsByCategory,
  
  // Model Configs
  getAllModelConfigs, 
  getDatasetConfigs,
};
// /**
//  * Shaped AI Services - Main Export
//  */

// import ShapedClient, { shapedClient } from './shapedClient.js';
// import { EVENT_TYPES, getEventLabel, isPositiveEvent, isNegativeEvent } from './eventTypes.js';
// import { syncUsersToShaped, syncSingleUser, getRegionFromCountry, REGION_MAP } from './userSync.js';
// import { syncElectionsToShaped, syncSingleElection, getActiveElectionsCount, ELECTION_STATUS, VOTING_TYPES } from './electionSync.js';
// import {
//   syncAllVotesToShaped,
//   syncRegularVotesToShaped,
//   syncAnonymousVotesToShaped,
//   syncParticipationToShaped,
//   syncSingleVote,
//   getVoteCounts
// } from './voteSync.js';
// import {
//   trackEvent, trackVoteCast, trackElectionView, trackElectionShared, trackElectionSaved,
//   trackElectionSkipped, trackLotteryWin, trackVerificationDone, trackResultsView,
//   trackElectionCreated, batchTrackEvents, getBufferSize, forceFlush
// } from './eventTracker.js';
// import {
//   getElectionsForYou, getSimilarElections, getTrendingElections,
//   getAudienceForElection, getLotterizedPicks, getElectionsByCategory
// } from './recommendations.js';
// import { getAllModelConfigs, getDatasetConfigs } from './modelDefinitions.js';

// export {
//   // Client
//   ShapedClient, 
//   shapedClient,
  
//   // Event Types
//   EVENT_TYPES, 
//   getEventLabel, 
//   isPositiveEvent, 
//   isNegativeEvent,
  
//   // User Sync
//   syncUsersToShaped, 
//   syncSingleUser, 
//   getRegionFromCountry, 
//   REGION_MAP,
  
//   // Election Sync
//   syncElectionsToShaped, 
//   syncSingleElection, 
//   getActiveElectionsCount, 
//   ELECTION_STATUS, 
//   VOTING_TYPES,
  
//   // Vote Sync (NEW)
//   syncAllVotesToShaped,
//   syncRegularVotesToShaped,
//   syncAnonymousVotesToShaped,
//   syncParticipationToShaped,
//   syncSingleVote,
//   getVoteCounts,
  
//   // Event Tracking
//   trackEvent, 
//   trackVoteCast, 
//   trackElectionView, 
//   trackElectionShared, 
//   trackElectionSaved,
//   trackElectionSkipped, 
//   trackLotteryWin, 
//   trackVerificationDone, 
//   trackResultsView,
//   trackElectionCreated, 
//   batchTrackEvents, 
//   getBufferSize, 
//   forceFlush,
  
//   // Recommendations
//   getElectionsForYou, 
//   getSimilarElections, 
//   getTrendingElections,
//   getAudienceForElection, 
//   getLotterizedPicks, 
//   getElectionsByCategory,
  
//   // Model Configs
//   getAllModelConfigs, 
//   getDatasetConfigs,
// };

// export default {
//   // Client
//   ShapedClient, 
//   shapedClient,
  
//   // Event Types
//   EVENT_TYPES, 
//   getEventLabel, 
//   isPositiveEvent, 
//   isNegativeEvent,
  
//   // User Sync
//   syncUsersToShaped, 
//   syncSingleUser, 
//   getRegionFromCountry, 
//   REGION_MAP,
  
//   // Election Sync
//   syncElectionsToShaped, 
//   syncSingleElection, 
//   getActiveElectionsCount, 
//   ELECTION_STATUS, 
//   VOTING_TYPES,
  
//   // Vote Sync (NEW)
//   syncAllVotesToShaped,
//   syncRegularVotesToShaped,
//   syncAnonymousVotesToShaped,
//   syncParticipationToShaped,
//   syncSingleVote,
//   getVoteCounts,
  
//   // Event Tracking
//   trackEvent, 
//   trackVoteCast, 
//   trackElectionView, 
//   trackElectionShared, 
//   trackElectionSaved,
//   trackElectionSkipped, 
//   trackLotteryWin, 
//   trackVerificationDone, 
//   trackResultsView,
//   trackElectionCreated, 
//   batchTrackEvents, 
//   getBufferSize, 
//   forceFlush,
  
//   // Recommendations
//   getElectionsForYou, 
//   getSimilarElections, 
//   getTrendingElections,
//   getAudienceForElection, 
//   getLotterizedPicks, 
//   getElectionsByCategory,
  
//   // Model Configs
//   getAllModelConfigs, 
//   getDatasetConfigs,
// };
// /**
//  * Shaped AI Services - Main Export
//  */

// import ShapedClient, { shapedClient } from './shapedClient.js';
// import { EVENT_TYPES, getEventLabel, isPositiveEvent, isNegativeEvent } from './eventTypes.js';
// import { syncUsersToShaped, syncSingleUser, getRegionFromCountry, REGION_MAP } from './userSync.js';
// import { syncElectionsToShaped, syncSingleElection, getActiveElectionsCount, ELECTION_STATUS, VOTING_TYPES } from './electionSync.js';
// import {
//   trackEvent, trackVoteCast, trackElectionView, trackElectionShared, trackElectionSaved,
//   trackElectionSkipped, trackLotteryWin, trackVerificationDone, trackResultsView,
//   trackElectionCreated, batchTrackEvents, getBufferSize, forceFlush
// } from './eventTracker.js';
// import {
//   getElectionsForYou, getSimilarElections, getTrendingElections,
//   getAudienceForElection, getLotterizedPicks, getElectionsByCategory
// } from './recommendations.js';
// import { getAllModelConfigs, getDatasetConfigs } from './modelDefinitions.js';

// export {
//   ShapedClient, shapedClient,
//   EVENT_TYPES, getEventLabel, isPositiveEvent, isNegativeEvent,
//   syncUsersToShaped, syncSingleUser, getRegionFromCountry, REGION_MAP,
//   syncElectionsToShaped, syncSingleElection, getActiveElectionsCount, ELECTION_STATUS, VOTING_TYPES,
//   trackEvent, trackVoteCast, trackElectionView, trackElectionShared, trackElectionSaved,
//   trackElectionSkipped, trackLotteryWin, trackVerificationDone, trackResultsView,
//   trackElectionCreated, batchTrackEvents, getBufferSize, forceFlush,
//   getElectionsForYou, getSimilarElections, getTrendingElections,
//   getAudienceForElection, getLotterizedPicks, getElectionsByCategory,
//   getAllModelConfigs, getDatasetConfigs,
// };

// export default {
//   ShapedClient, shapedClient,
//   EVENT_TYPES, getEventLabel, isPositiveEvent, isNegativeEvent,
//   syncUsersToShaped, syncSingleUser, getRegionFromCountry, REGION_MAP,
//   syncElectionsToShaped, syncSingleElection, getActiveElectionsCount, ELECTION_STATUS, VOTING_TYPES,
//   trackEvent, trackVoteCast, trackElectionView, trackElectionShared, trackElectionSaved,
//   trackElectionSkipped, trackLotteryWin, trackVerificationDone, trackResultsView,
//   trackElectionCreated, batchTrackEvents, getBufferSize, forceFlush,
//   getElectionsForYou, getSimilarElections, getTrendingElections,
//   getAudienceForElection, getLotterizedPicks, getElectionsByCategory,
//   getAllModelConfigs, getDatasetConfigs,
// };
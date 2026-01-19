/**
 * Event Tracker Service
 */

import { v4 as uuidv4 } from 'uuid';
import { shapedClient } from './shapedClient.js';
import { EVENT_TYPES, getEventLabel } from './eventTypes.js';
//import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

let eventBuffer = [];
const BUFFER_FLUSH_SIZE = 100;
const BUFFER_FLUSH_INTERVAL_MS = 5000;

const flushEventBuffer = async () => {
  if (eventBuffer.length === 0) return;
  
  const eventsToSend = [...eventBuffer];
  eventBuffer = [];
  
  try {
    await shapedClient.insertDataset(config.shaped.datasets.events, eventsToSend);
    logger.debug({ count: eventsToSend.length }, 'Event buffer flushed');
  } catch (error) {
    eventBuffer = [...eventsToSend, ...eventBuffer];
    logger.error({ error: error.message }, 'Failed to flush event buffer');
  }
};

setInterval(flushEventBuffer, BUFFER_FLUSH_INTERVAL_MS);

const createBaseEvent = ({ userId, electionId, eventType, metadata = {} }) => ({
  event_id: uuidv4(),
  user_id: String(userId),
  item_id: String(electionId),
  event_type: eventType,
  label: getEventLabel(eventType),
  created_at: new Date().toISOString(),
  metadata: JSON.stringify(metadata),
});

export const trackEvent = async (params) => {
  const { immediate = false } = params;
  const event = createBaseEvent(params);
  
  if (immediate) {
    try {
      await shapedClient.insertDataset(config.shaped.datasets.events, [event]);
      logger.debug({ eventType: params.eventType, userId: params.userId }, 'Immediate event sent');
      return { success: true, event };
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to send immediate event');
      eventBuffer.push(event);
      return { success: false, buffered: true, event };
    }
  }
  
  eventBuffer.push(event);
  
  if (eventBuffer.length >= BUFFER_FLUSH_SIZE) {
    await flushEventBuffer();
  }
  
  return { success: true, buffered: true, event };
};

export const trackVoteCast = (userId, electionId, metadata = {}) => 
  trackEvent({ userId, electionId, eventType: EVENT_TYPES.VOTE_CAST, metadata: { ...metadata, action: 'vote_cast' }, immediate: true });

export const trackElectionView = (userId, electionId, metadata = {}) => 
  trackEvent({ userId, electionId, eventType: EVENT_TYPES.VIEW_ELECTION, metadata: { ...metadata, action: 'view_election' } });

export const trackElectionShared = (userId, electionId, metadata = {}) => 
  trackEvent({ userId, electionId, eventType: EVENT_TYPES.ELECTION_SHARED, metadata: { ...metadata, action: 'election_shared' } });

export const trackElectionSaved = (userId, electionId) => 
  trackEvent({ userId, electionId, eventType: EVENT_TYPES.ELECTION_SAVED, metadata: { action: 'election_saved' } });

export const trackElectionSkipped = (userId, electionId) => 
  trackEvent({ userId, electionId, eventType: EVENT_TYPES.ELECTION_SKIPPED, metadata: { action: 'election_skipped' } });

export const trackLotteryWin = (userId, electionId, metadata = {}) => 
  trackEvent({ userId, electionId, eventType: EVENT_TYPES.LOTTERY_WIN, metadata: { ...metadata, action: 'lottery_win' }, immediate: true });

export const trackVerificationDone = (userId, electionId) => 
  trackEvent({ userId, electionId, eventType: EVENT_TYPES.VERIFICATION_DONE, metadata: { action: 'verification_done' } });

export const trackResultsView = (userId, electionId) => 
  trackEvent({ userId, electionId, eventType: EVENT_TYPES.VIEW_RESULTS, metadata: { action: 'view_results' } });

export const trackElectionCreated = (creatorId, electionId, metadata = {}) => 
  trackEvent({ userId: creatorId, electionId, eventType: EVENT_TYPES.ELECTION_CREATED, metadata: { ...metadata, action: 'election_created', is_creator_event: true }, immediate: true });

export const batchTrackEvents = async (events) => {
  const transformedEvents = events.map(event => createBaseEvent(event));
  const batchSize = 1000;
  let totalSent = 0;
  
  for (let i = 0; i < transformedEvents.length; i += batchSize) {
    const batch = transformedEvents.slice(i, i + batchSize);
    await shapedClient.insertDataset(config.shaped.datasets.events, batch);
    totalSent += batch.length;
    logger.debug({ sent: totalSent, total: transformedEvents.length }, 'Batch events sent');
  }
  
  return { success: true, totalSent };
};

export const getBufferSize = () => eventBuffer.length;

export const forceFlush = async () => {
  await flushEventBuffer();
};

export default {
  trackEvent, trackVoteCast, trackElectionView, trackElectionShared, trackElectionSaved,
  trackElectionSkipped, trackLotteryWin, trackVerificationDone, trackResultsView,
  trackElectionCreated, batchTrackEvents, getBufferSize, forceFlush,
};
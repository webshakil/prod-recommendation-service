/**
 * Event Types for Shaped AI
 * Defines all user interaction events and their labels (weights) for the recommendation model
 */

/**
 * Event Types Enum
 * These represent different user interactions with elections
 */
export const EVENT_TYPES = {
  // High-value positive events (user took meaningful action)
  VOTE_CAST: 'vote_cast',
  ELECTION_SHARED: 'election_shared',
  ELECTION_SAVED: 'election_saved',
  LOTTERY_WIN: 'lottery_win',
  ELECTION_CREATED: 'election_created',
  VERIFICATION_DONE: 'verification_done',

  // Medium-value positive events (user showed interest)
  VIEW_ELECTION: 'view_election',
  VIEW_RESULTS: 'view_results',
  VIDEO_WATCHED: 'video_watched',
  COMMENT_ADDED: 'comment_added',

  // Low/Negative events (user rejected content)
  ELECTION_SKIPPED: 'election_skipped',
  ELECTION_HIDDEN: 'election_hidden',
  ELECTION_REPORTED: 'election_reported',

  // Neutral events (for tracking, not ranking)
  FEED_IMPRESSION: 'feed_impression',
  SEARCH_CLICK: 'search_click',
};

/**
 * Event Labels (Weights) for Shaped AI
 * 
 * Shaped AI uses these labels to train the recommendation model:
 * - Higher values (0.8-1.0) = Strong positive signal (user really liked this)
 * - Medium values (0.3-0.6) = Moderate positive signal
 * - Low values (0.0-0.2) = Weak or no signal
 * - Negative values (-0.5 to -1.0) = Negative signal (user disliked this)
 */
export const EVENT_LABELS = {
  // Strong positive signals
  [EVENT_TYPES.VOTE_CAST]: 1.0,           // User completed the core action
  [EVENT_TYPES.LOTTERY_WIN]: 1.0,         // User had great experience
  [EVENT_TYPES.ELECTION_SHARED]: 0.9,     // User advocated for content
  [EVENT_TYPES.ELECTION_SAVED]: 0.8,      // User wants to return
  [EVENT_TYPES.ELECTION_CREATED]: 0.8,    // Creator engagement
  [EVENT_TYPES.VERIFICATION_DONE]: 0.7,   // User invested effort

  // Medium positive signals
  [EVENT_TYPES.VIEW_RESULTS]: 0.5,        // User curious about outcome
  [EVENT_TYPES.VIDEO_WATCHED]: 0.5,       // User consumed content
  [EVENT_TYPES.COMMENT_ADDED]: 0.6,       // User engaged in discussion
  [EVENT_TYPES.VIEW_ELECTION]: 0.3,       // Basic interest signal

  // Negative signals
  [EVENT_TYPES.ELECTION_SKIPPED]: -0.3,   // User passed on content
  [EVENT_TYPES.ELECTION_HIDDEN]: -0.7,    // User actively rejected
  [EVENT_TYPES.ELECTION_REPORTED]: -1.0,  // User flagged as problematic

  // Neutral (for tracking only)
  [EVENT_TYPES.FEED_IMPRESSION]: 0.0,
  [EVENT_TYPES.SEARCH_CLICK]: 0.1,
};

/**
 * Get the label (weight) for an event type
 * @param {string} eventType - The event type
 * @returns {number} The label value for Shaped AI
 */
export const getEventLabel = (eventType) => {
  return EVENT_LABELS[eventType] ?? 0.0;
};

/**
 * Check if an event is a positive signal
 * @param {string} eventType - The event type
 * @returns {boolean}
 */
export const isPositiveEvent = (eventType) => {
  return getEventLabel(eventType) > 0;
};

/**
 * Check if an event is a negative signal
 * @param {string} eventType - The event type
 * @returns {boolean}
 */
export const isNegativeEvent = (eventType) => {
  return getEventLabel(eventType) < 0;
};

/**
 * Get all positive event types (for model queries)
 * @returns {string[]}
 */
export const getPositiveEventTypes = () => {
  return Object.keys(EVENT_LABELS).filter(type => EVENT_LABELS[type] > 0);
};

/**
 * Get high-value event types (label >= 0.7)
 * @returns {string[]}
 */
export const getHighValueEventTypes = () => {
  return Object.keys(EVENT_LABELS).filter(type => EVENT_LABELS[type] >= 0.7);
};

export default {
  EVENT_TYPES,
  EVENT_LABELS,
  getEventLabel,
  isPositiveEvent,
  isNegativeEvent,
  getPositiveEventTypes,
  getHighValueEventTypes,
};
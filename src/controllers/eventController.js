/**
 * Event Controller
 */

//import * as shaped from '../services/shaped/shaped.js';
import * as shaped from '../services/shaped/index.js';
import logger from '../utils/logger.js';

export const trackEvent = async (req, res) => {
  try {
    const { userId, electionId, eventType, metadata } = req.body;

    if (!userId || !electionId || !eventType) {
      return res.status(400).json({ success: false, error: 'userId, electionId, and eventType are required' });
    }

    if (!Object.values(shaped.EVENT_TYPES).includes(eventType)) {
      return res.status(400).json({ success: false, error: `Invalid eventType. Valid types: ${Object.values(shaped.EVENT_TYPES).join(', ')}` });
    }

    const result = await shaped.trackEvent({ userId, electionId, eventType, metadata: metadata || {} });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: trackEvent');
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
};

export const trackVote = async (req, res) => {
  try {
    const { userId, electionId, voteDetails } = req.body;

    if (!userId || !electionId) {
      return res.status(400).json({ success: false, error: 'userId and electionId are required' });
    }

    const result = await shaped.trackVoteCast(userId, electionId, voteDetails || {});
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: trackVote');
    res.status(500).json({ success: false, error: 'Failed to track vote' });
  }
};

export const trackView = async (req, res) => {
  try {
    const { userId, electionId, source } = req.body;

    if (!userId || !electionId) {
      return res.status(400).json({ success: false, error: 'userId and electionId are required' });
    }

    const result = await shaped.trackElectionView(userId, electionId, { source });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: trackView');
    res.status(500).json({ success: false, error: 'Failed to track view' });
  }
};

export const trackShare = async (req, res) => {
  try {
    const { userId, electionId, platform } = req.body;

    if (!userId || !electionId) {
      return res.status(400).json({ success: false, error: 'userId and electionId are required' });
    }

    const result = await shaped.trackElectionShared(userId, electionId, { platform });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: trackShare');
    res.status(500).json({ success: false, error: 'Failed to track share' });
  }
};

export const trackLotteryWin = async (req, res) => {
  try {
    const { userId, electionId, prizeAmount, rank } = req.body;

    if (!userId || !electionId) {
      return res.status(400).json({ success: false, error: 'userId and electionId are required' });
    }

    const result = await shaped.trackLotteryWin(userId, electionId, { prizeAmount, rank });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: trackLotteryWin');
    res.status(500).json({ success: false, error: 'Failed to track lottery win' });
  }
};

export const trackElectionCreated = async (req, res) => {
  try {
    const { creatorId, electionId, electionDetails } = req.body;

    if (!creatorId || !electionId) {
      return res.status(400).json({ success: false, error: 'creatorId and electionId are required' });
    }

    const result = await shaped.trackElectionCreated(creatorId, electionId, electionDetails || {});
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: trackElectionCreated');
    res.status(500).json({ success: false, error: 'Failed to track election created' });
  }
};

export const batchTrackEvents = async (req, res) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, error: 'events array is required' });
    }

    for (const event of events) {
      if (!event.userId || !event.electionId || !event.eventType) {
        return res.status(400).json({ success: false, error: 'Each event must have userId, electionId, and eventType' });
      }
    }

    const result = await shaped.batchTrackEvents(events);
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: batchTrackEvents');
    res.status(500).json({ success: false, error: 'Failed to batch track events' });
  }
};

export const getBufferStatus = async (req, res) => {
  try {
    const bufferSize = shaped.getBufferSize();
    res.json({ success: true, bufferSize, maxSize: 100 });
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: getBufferStatus');
    res.status(500).json({ success: false, error: 'Failed to get buffer status' });
  }
};

export const flushBuffer = async (req, res) => {
  try {
    await shaped.forceFlush();
    res.json({ success: true, message: 'Event buffer flushed successfully' });
  } catch (error) {
    logger.error({ error: error.message }, 'Controller error: flushBuffer');
    res.status(500).json({ success: false, error: 'Failed to flush buffer' });
  }
};

export default {
  trackEvent, trackVote, trackView, trackShare, trackLotteryWin,
  trackElectionCreated, batchTrackEvents, getBufferStatus, flushBuffer,
};
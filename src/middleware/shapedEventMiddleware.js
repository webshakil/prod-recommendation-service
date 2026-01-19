/**
 * Shaped Event Middleware
 * For use in other services to auto-track events
 */

import logger from '../utils/logger.js';

const RECOMMENDATION_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3007';

const sendEventToRecommendationService = async (eventData) => {
  try {
    await fetch(`${RECOMMENDATION_SERVICE_URL}/api/events/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    logger.error({ error: error.message, eventData }, 'Failed to send event');
  }
};

export const trackVoteMiddleware = () => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success !== false) {
      const userId = req.body.userId || req.user?.id;
      const electionId = req.body.electionId || req.params.electionId;
      if (userId && electionId) {
        sendEventToRecommendationService({ userId, electionId, eventType: 'vote_cast', metadata: { source: req.headers['x-source'] || 'web' } });
      }
    }
    return originalJson(data);
  };
  next();
};

export const trackViewMiddleware = () => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success !== false) {
      const userId = req.query.userId || req.user?.id;
      const electionId = req.params.electionId || req.params.id;
      if (userId && electionId) {
        sendEventToRecommendationService({ userId, electionId, eventType: 'view_election', metadata: { source: req.headers['x-source'] || 'web' } });
      }
    }
    return originalJson(data);
  };
  next();
};

export const trackShareMiddleware = () => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success !== false) {
      const userId = req.body.userId || req.user?.id;
      const electionId = req.body.electionId || req.params.electionId;
      if (userId && electionId) {
        sendEventToRecommendationService({ userId, electionId, eventType: 'election_shared', metadata: { platform: req.body.platform || 'unknown' } });
      }
    }
    return originalJson(data);
  };
  next();
};

export const trackElectionCreatedMiddleware = () => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300 && data.success !== false) {
      const creatorId = req.body.creatorId || req.user?.id;
      const electionId = data.election?.id || data.electionId;
      if (creatorId && electionId) {
        sendEventToRecommendationService({ userId: creatorId, electionId, eventType: 'election_created', metadata: { title: req.body.title, category: req.body.category } });
      }
    }
    return originalJson(data);
  };
  next();
};

export const createEventMiddleware = (eventType, extractData = null) => {
  const defaultExtractor = (req) => ({
    userId: req.body.userId || req.user?.id || req.query.userId,
    electionId: req.body.electionId || req.params.electionId || req.params.id,
    metadata: {},
  });

  const dataExtractor = extractData || defaultExtractor;

  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300 && data.success !== false) {
        const eventData = dataExtractor(req, res, data);
        if (eventData.userId && eventData.electionId) {
          sendEventToRecommendationService({ userId: eventData.userId, electionId: eventData.electionId, eventType, metadata: eventData.metadata || {} });
        }
      }
      return originalJson(data);
    };
    next();
  };
};

export default {
  trackVoteMiddleware, trackViewMiddleware, trackShareMiddleware,
  trackElectionCreatedMiddleware, createEventMiddleware, sendEventToRecommendationService,
};
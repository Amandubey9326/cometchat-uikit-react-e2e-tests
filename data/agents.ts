import '@config/env';

/**
 * AI agents are created in the dashboard (AI → Agent Builder), not through REST, so tests use
 * existing agent UIDs from .env. Tests that need them skip when they are not set.
 */
export const AI_AGENTS = [process.env.AI_AGENT_UID, process.env.AI_AGENT_2_UID]
  .map(uid => uid?.trim())
  .filter((uid): uid is string => !!uid);

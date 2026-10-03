export interface TestUser {
  uid: string;
  /** Display name — unique per test so UI lookups never hit someone else's user. */
  name: string;
}

/**
 * Named roles used by the fixtures. Each is a fresh user created for the test
 * that uses it: alice = sender / group owner, bob = receiver, carol = admin,
 * dave = moderator, erin = participant, frank = outsider.
 */
export const PERSONA_KEYS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

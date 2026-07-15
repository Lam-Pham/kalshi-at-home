// Identity primitives. Runs in the Workers runtime where `crypto` is global.

/** Opaque primary key for groups / members / offers / fills. */
export function newId(): string {
  return crypto.randomUUID();
}

// Unambiguous alphabet — no 0/O/1/I/L/U to keep shared codes easy to read aloud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LENGTH = 10;

/** Short, URL-safe, shareable room invite code. */
export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Opaque URL token for a shared one-off bet (~60 bits of entropy). */
export function newBetCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/**
 * Cookie that ties this device to its membership in a given group.
 * Identity = display name + device cookie; one cookie per joined room, so a
 * device can belong to several rooms. New device = rejoin via invite link.
 */
export function memberCookieName(groupId: string): string {
  return `kf_m_${groupId}`;
}

export const MEMBER_COOKIE_PREFIX = "kf_m_";

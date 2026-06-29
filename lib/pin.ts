// Salted PIN hashing via Web Crypto (PBKDF2-SHA256), available globally in the
// Workers runtime. A 4-digit PIN is low-entropy by nature, so this is hygiene +
// a little brute-force friction — not strong secrecy. It fits a no-money friends
// ledger, where the real backstop is the admin "reset PIN" action. The stored
// value is self-describing: `saltHex:hashHex`.

const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS },
    key,
    KEY_BYTES * 8,
  );
  return toHex(new Uint8Array(bits));
}

/** Hash a PIN into a `saltHex:hashHex` string for storage. */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return `${toHex(salt)}:${await derive(pin, salt)}`;
}

/** Check a PIN against a stored `saltHex:hashHex`, comparing in constant time. */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const got = await derive(pin, fromHex(saltHex));
  if (got.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

// IDs for local characters, saved runs and save revisions, never authentication.
let counter = 0;
export function localId() {
  try {
    const provider = globalThis.crypto;
    if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
    if (typeof provider?.getRandomValues === 'function') {
      const bytes = provider.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // Older or restricted browsers can still keep distinct local-only IDs.
  }
  return `local-${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.floor(Math.random() * 0x100000000).toString(36)}`;
}

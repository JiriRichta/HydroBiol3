// Content fingerprinting to block re-importing the exact same file (IMP-09).

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<string>} lowercase hex SHA-256 digest
 */
export async function fingerprintBytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

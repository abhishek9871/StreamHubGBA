/**
 * Server-side Decryption Utilities
 * 
 * XOR cipher decryption for vidsrc encrypted data
 * Uses Node.js Buffer instead of browser APIs
 */

/**
 * Decode encrypted data using XOR cipher with cycling seed
 * 
 * Algorithm:
 * 1. Base64 decode the encrypted string
 * 2. XOR each byte with the seed (cycling through seed characters)
 * 3. UTF-8 decode the result
 */
export function decryptVidsrc(encoded: string, seed: string): string {
  try {
    // Step 1: Base64 decode using Node.js Buffer
    const decoded = Buffer.from(encoded, 'base64');
    
    // Step 2: XOR with seed
    const seedBuffer = Buffer.from(seed, 'utf-8');
    const result = Buffer.alloc(decoded.length);
    
    for (let i = 0; i < decoded.length; i++) {
      result[i] = decoded[i] ^ seedBuffer[i % seedBuffer.length];
    }
    
    // Step 3: UTF-8 decode
    return result.toString('utf-8');
  } catch (error) {
    console.error('[Decrypt] XOR decryption failed:', error);
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Alternative decryption - double base64 + XOR
 */
export function decryptVidsrcAlt(encoded: string, seed: string): string {
  try {
    // Some sources double-encode
    let decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    
    // Check if result looks like base64
    if (/^[A-Za-z0-9+/=]+$/.test(decoded)) {
      decoded = Buffer.from(decoded, 'base64').toString('utf-8');
    }
    
    // XOR with seed
    const seedBuffer = Buffer.from(seed, 'utf-8');
    let result = '';
    
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ seedBuffer[i % seedBuffer.length]);
    }
    
    return result;
  } catch (error) {
    console.error('[Decrypt] Alt decryption failed:', error);
    throw error;
  }
}

/**
 * RC4 decrypt - Some sources use RC4
 */
export function decryptRC4(data: string, key: string): string {
  // Initialize S-box
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  
  // Key-scheduling algorithm (KSA)
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  // Pseudo-random generation algorithm (PRGA)
  let i = 0;
  j = 0;
  let result = '';
  
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    const keyStreamByte = S[(S[i] + S[j]) % 256];
    result += String.fromCharCode(data.charCodeAt(k) ^ keyStreamByte);
  }
  
  return result;
}

/**
 * Extract URL from decrypted data
 */
export function extractUrlFromDecrypted(decrypted: string): string | null {
  // Try to find URL pattern
  const urlPattern = /https?:\/\/[^\s"'<>]+/g;
  const matches = decrypted.match(urlPattern);
  
  if (matches && matches.length > 0) {
    // Prefer m3u8 URLs
    const m3u8Url = matches.find(url => url.includes('.m3u8'));
    if (m3u8Url) {
      return cleanUrl(m3u8Url);
    }
    
    // Return first valid URL
    return cleanUrl(matches[0]);
  }
  
  // Check if entire string is a URL
  const trimmed = decrypted.trim();
  if (isValidUrl(trimmed)) {
    return trimmed;
  }
  
  // Try to extract from JSON-like structure
  try {
    const jsonMatch = decrypted.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.file || parsed.url || parsed.source) {
        return parsed.file || parsed.url || parsed.source;
      }
    }
  } catch {
    // Not valid JSON
  }
  
  return null;
}

/**
 * Clean URL (remove trailing garbage)
 */
function cleanUrl(url: string): string {
  // Remove common trailing characters that aren't part of URL
  return url.replace(/['"<>\s]+$/, '');
}

/**
 * Validate URL
 */
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Hex dump for debugging
 */
export function hexDump(str: string, maxBytes: number = 32): string {
  const bytes = Buffer.from(str, 'utf-8');
  const hex = bytes.slice(0, maxBytes).toString('hex').match(/.{1,2}/g)?.join(' ') || '';
  return `${hex}${bytes.length > maxBytes ? '...' : ''} (${bytes.length} bytes)`;
}

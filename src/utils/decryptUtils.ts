/**
 * VidSrc Decryption Utilities
 * 
 * XOR cipher decryption for vidsrc.cc/vidsrc.stream encrypted data
 * Based on: https://github.com/Ciarands/vidsrc-me-resolver
 * 
 * Algorithm:
 * 1. Base64 decode the encrypted string
 * 2. XOR each byte with the seed (cycling through seed characters)
 * 3. UTF-8 decode the result
 */

/**
 * VidsrcCrypto - Handles decryption of vidsrc encrypted data
 */
export class VidsrcCrypto {
  /**
   * Decode encrypted data using XOR cipher with cycling seed
   * 
   * @param encoded - Base64 encoded encrypted string (from data-h attribute)
   * @param seed - Seed string for XOR decryption (from data-i attribute)
   * @returns Decrypted string (usually a URL or nested data)
   */
  static decode(encoded: string, seed: string): string {
    try {
      console.log('[VidsrcCrypto] Starting decryption...');
      console.log('[VidsrcCrypto] Encoded length:', encoded.length);
      console.log('[VidsrcCrypto] Seed:', seed);

      // Step 1: Base64 decode
      const decoded = atob(encoded);
      console.log('[VidsrcCrypto] Base64 decoded length:', decoded.length);

      // Step 2: Convert to byte array and XOR with seed
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i);
        const seedChar = seed.charCodeAt(i % seed.length);
        bytes[i] = charCode ^ seedChar;
      }

      // Step 3: UTF-8 decode the result
      const result = new TextDecoder('utf-8').decode(bytes);
      console.log('[VidsrcCrypto] Decrypted result (first 100 chars):', result.substring(0, 100));

      return result;
    } catch (error) {
      console.error('[VidsrcCrypto] Decryption failed:', error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Alternative decode method using string-based XOR
   * Some implementations use this pattern
   */
  static decodeAlt(encoded: string, seed: string): string {
    try {
      const decoded = atob(encoded);
      let result = '';
      
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i);
        const seedChar = seed.charCodeAt(i % seed.length);
        result += String.fromCharCode(charCode ^ seedChar);
      }
      
      return result;
    } catch (error) {
      console.error('[VidsrcCrypto] Alt decryption failed:', error);
      throw new Error(`Alt decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * RC4 decrypt - Some sources use RC4 instead of simple XOR
   * Keeping this for potential future use
   */
  static rc4Decrypt(data: string, key: string): string {
    try {
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
    } catch (error) {
      console.error('[VidsrcCrypto] RC4 decryption failed:', error);
      throw error;
    }
  }

  /**
   * Validate if a string looks like a valid URL
   */
  static isValidUrl(str: string): boolean {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Extract URL from decrypted data
   * Sometimes the decrypted result contains additional data around the URL
   */
  static extractUrl(decryptedData: string): string | null {
    // Try to find a URL pattern in the decrypted data
    const urlPattern = /https?:\/\/[^\s"'<>]+/g;
    const matches = decryptedData.match(urlPattern);
    
    if (matches && matches.length > 0) {
      // Return the first valid-looking URL
      for (const match of matches) {
        if (this.isValidUrl(match)) {
          console.log('[VidsrcCrypto] Extracted URL:', match);
          return match;
        }
      }
    }
    
    // If no URL pattern found, check if the entire string is a URL
    if (this.isValidUrl(decryptedData.trim())) {
      return decryptedData.trim();
    }
    
    console.log('[VidsrcCrypto] No valid URL found in decrypted data');
    return null;
  }
}

/**
 * Utility functions for debugging
 */
export function hexDump(str: string, maxBytes: number = 32): string {
  const bytes = [];
  for (let i = 0; i < Math.min(str.length, maxBytes); i++) {
    bytes.push(str.charCodeAt(i).toString(16).padStart(2, '0'));
  }
  return bytes.join(' ');
}

export function debugDecryption(encoded: string, seed: string): void {
  console.log('=== Decryption Debug ===');
  console.log('Encoded (first 50 chars):', encoded.substring(0, 50));
  console.log('Seed:', seed);
  
  try {
    const decoded = atob(encoded);
    console.log('Base64 decoded hex:', hexDump(decoded));
    
    const result = VidsrcCrypto.decode(encoded, seed);
    console.log('Decrypted result:', result);
    console.log('Is valid URL:', VidsrcCrypto.isValidUrl(result));
  } catch (error) {
    console.error('Debug decryption failed:', error);
  }
}

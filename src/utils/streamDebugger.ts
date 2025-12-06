/**
 * Stream Debugger Utility
 * 
 * Helper functions for testing and debugging stream extraction
 * Run these from browser console to test extraction
 */

import { streamExtractor, extractStreams, extractWithHash } from '../services/streamExtractor';
import { vidsrcApi } from '../services/vidsrcApi';
import { VidsrcCrypto, debugDecryption } from './decryptUtils';
import type { StreamExtractionResult } from '../types/stream';

/**
 * Test movie stream extraction
 * 
 * Usage in browser console:
 * import { testMovie } from './src/utils/streamDebugger';
 * testMovie('278'); // Shawshank Redemption
 */
export async function testMovie(tmdbId: string): Promise<StreamExtractionResult> {
  console.log('='.repeat(60));
  console.log(`[StreamDebugger] Testing MOVIE extraction`);
  console.log(`[StreamDebugger] TMDB ID: ${tmdbId}`);
  console.log('='.repeat(60));

  const startTime = performance.now();

  try {
    const result = await extractStreams({
      type: 'movie',
      tmdbId,
    });

    const elapsed = (performance.now() - startTime).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('[StreamDebugger] EXTRACTION RESULT');
    console.log('='.repeat(60));
    console.log('Success:', result.success);
    console.log('Streams found:', result.streams.length);
    console.log('Time elapsed:', elapsed, 'ms');

    if (result.success && result.streams.length > 0) {
      console.log('\n[StreamDebugger] STREAMS:');
      result.streams.forEach((stream, index) => {
        console.log(`\n  Stream ${index + 1}:`);
        console.log(`    Provider: ${stream.provider}`);
        console.log(`    Quality: ${stream.quality}`);
        console.log(`    URL: ${stream.url}`);
        console.log(`    Is m3u8: ${stream.url.includes('.m3u8')}`);
        if (stream.headers) {
          console.log(`    Headers:`, stream.headers);
        }
      });
    }

    if (result.error) {
      console.log('\n[StreamDebugger] ERROR:');
      console.log(`  Code: ${result.error.code}`);
      console.log(`  Message: ${result.error.message}`);
      console.log(`  Step: ${result.error.step}`);
    }

    if (result.debugMetadata) {
      console.log('\n[StreamDebugger] DEBUG METADATA:');
      console.log(`  Provider: ${result.debugMetadata.provider}`);
      console.log(`  Embed URL: ${result.debugMetadata.embedUrl}`);
      console.log(`  Servers found: ${result.debugMetadata.serversFound}`);
      console.log(`  Steps completed:`, result.debugMetadata.stepsCompleted);
      console.log(`  Extraction time: ${result.debugMetadata.extractionTimeMs}ms`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('[StreamDebugger] Full result object:');
    console.log(result);
    console.log('='.repeat(60));

    return result;
  } catch (error) {
    console.error('\n[StreamDebugger] UNEXPECTED ERROR:', error);
    throw error;
  }
}

/**
 * Test TV show stream extraction
 * 
 * Usage in browser console:
 * import { testTV } from './src/utils/streamDebugger';
 * testTV('1396', 1, 1); // Breaking Bad S01E01
 */
export async function testTV(
  tmdbId: string, 
  season: number, 
  episode: number
): Promise<StreamExtractionResult> {
  console.log('='.repeat(60));
  console.log(`[StreamDebugger] Testing TV extraction`);
  console.log(`[StreamDebugger] TMDB ID: ${tmdbId}`);
  console.log(`[StreamDebugger] Season: ${season}, Episode: ${episode}`);
  console.log('='.repeat(60));

  const startTime = performance.now();

  try {
    const result = await extractStreams({
      type: 'tv',
      tmdbId,
      season,
      episode,
    });

    const elapsed = (performance.now() - startTime).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('[StreamDebugger] EXTRACTION RESULT');
    console.log('='.repeat(60));
    console.log('Success:', result.success);
    console.log('Streams found:', result.streams.length);
    console.log('Time elapsed:', elapsed, 'ms');

    if (result.success && result.streams.length > 0) {
      console.log('\n[StreamDebugger] STREAMS:');
      result.streams.forEach((stream, index) => {
        console.log(`\n  Stream ${index + 1}:`);
        console.log(`    Provider: ${stream.provider}`);
        console.log(`    Quality: ${stream.quality}`);
        console.log(`    URL: ${stream.url}`);
        console.log(`    Is m3u8: ${stream.url.includes('.m3u8')}`);
        if (stream.headers) {
          console.log(`    Headers:`, stream.headers);
        }
      });
    }

    if (result.error) {
      console.log('\n[StreamDebugger] ERROR:');
      console.log(`  Code: ${result.error.code}`);
      console.log(`  Message: ${result.error.message}`);
      console.log(`  Step: ${result.error.step}`);
    }

    if (result.debugMetadata) {
      console.log('\n[StreamDebugger] DEBUG METADATA:');
      console.log(`  Provider: ${result.debugMetadata.provider}`);
      console.log(`  Embed URL: ${result.debugMetadata.embedUrl}`);
      console.log(`  Servers found: ${result.debugMetadata.serversFound}`);
      console.log(`  Steps completed:`, result.debugMetadata.stepsCompleted);
      console.log(`  Extraction time: ${result.debugMetadata.extractionTimeMs}ms`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('[StreamDebugger] Full result object:');
    console.log(result);
    console.log('='.repeat(60));

    return result;
  } catch (error) {
    console.error('\n[StreamDebugger] UNEXPECTED ERROR:', error);
    throw error;
  }
}

/**
 * Quick test with common movie IDs
 */
export async function runQuickTests(): Promise<void> {
  console.log('[StreamDebugger] Running quick tests...\n');

  const testCases = [
    { type: 'movie' as const, tmdbId: '278', name: 'The Shawshank Redemption' },
    { type: 'movie' as const, tmdbId: '550', name: 'Fight Club' },
    { type: 'tv' as const, tmdbId: '1396', season: 1, episode: 1, name: 'Breaking Bad S01E01' },
  ];

  for (const test of testCases) {
    console.log(`\nTesting: ${test.name}`);
    try {
      if (test.type === 'movie') {
        await testMovie(test.tmdbId);
      } else {
        await testTV(test.tmdbId, test.season!, test.episode!);
      }
    } catch (error) {
      console.error(`Failed to test ${test.name}:`, error);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Test decryption with sample or custom data
 * 
 * Usage in browser console:
 * window.streamDebugger.testDecryption(encrypted, seed)
 */
export function testDecryption(encrypted?: string, seed?: string): void {
  console.log('='.repeat(60));
  console.log('[StreamDebugger] Testing DECRYPTION');
  console.log('='.repeat(60));

  // If no params provided, show usage
  if (!encrypted || !seed) {
    console.log(`
Usage: testDecryption(encrypted, seed)

To get real data:
1. Run testMovie('278') first
2. Check console for "Found encrypted data" and "Found seed"
3. Copy those values and pass to this function

Example with fake data:
  testDecryption('SGVsbG8gV29ybGQh', 'key123')
    `);
    
    // Demo with simple test
    const testEncoded = btoa('Hello World!');
    const testSeed = 'key';
    console.log('\nDemo with test data:');
    console.log('  Encoded:', testEncoded);
    console.log('  Seed:', testSeed);
    
    try {
      const result = VidsrcCrypto.decode(testEncoded, testSeed);
      console.log('  Decrypted:', result);
    } catch (error) {
      console.error('  Demo decryption failed:', error);
    }
    return;
  }

  console.log('Encrypted length:', encrypted.length);
  console.log('Encrypted (first 50 chars):', encrypted.substring(0, 50));
  console.log('Seed:', seed);

  try {
    // Try primary decryption
    console.log('\n--- Primary XOR Decode ---');
    const decrypted = VidsrcCrypto.decode(encrypted, seed);
    console.log('Decrypted (first 200 chars):', decrypted.substring(0, 200));
    
    // Try to extract URL
    const url = VidsrcCrypto.extractUrl(decrypted);
    if (url) {
      console.log('\n✅ Extracted URL:', url);
      console.log('Is m3u8:', url.includes('.m3u8'));
    } else {
      console.log('\n⚠️ No URL found in decrypted data');
      
      // Check if it looks like nested base64
      if (decrypted.match(/^[A-Za-z0-9+/=]+$/)) {
        console.log('Looks like nested base64, trying second decode...');
        try {
          const nested = atob(decrypted);
          console.log('Nested decode result:', nested.substring(0, 200));
          const nestedUrl = VidsrcCrypto.extractUrl(nested);
          if (nestedUrl) {
            console.log('✅ Extracted nested URL:', nestedUrl);
          }
        } catch {
          console.log('Nested base64 decode failed');
        }
      }
    }
    
    // Also try alternative decode
    console.log('\n--- Alternative Decode ---');
    const altDecrypted = VidsrcCrypto.decodeAlt(encrypted, seed);
    console.log('Alt decrypted (first 200 chars):', altDecrypted.substring(0, 200));
    
  } catch (error) {
    console.error('Decryption failed:', error);
  }

  console.log('='.repeat(60));
}

/**
 * Test extraction with a known hash (from Playwright capture)
 * 
 * Usage:
 * window.streamDebugger.testHash("8gRy+i3edPABdONq...")
 */
export async function testHash(hash: string): Promise<void> {
  console.log('='.repeat(60));
  console.log('[StreamDebugger] Testing Hash Extraction');
  console.log('='.repeat(60));
  console.log('Hash preview:', hash.substring(0, 50) + '...');

  try {
    const result = await extractWithHash(hash, 'ManualTest');
    
    console.log('\nResult:');
    console.log('  Success:', result.success);
    
    if (result.success && result.extractedStream) {
      console.log('  ✅ m3u8 URL:', result.extractedStream.m3u8Url);
      console.log('  Subtitles:', result.extractedStream.subtitles.length);
      console.log('  Headers:', result.extractedStream.headers);
    } else if (result.error) {
      console.log('  ❌ Error:', result.error.message);
    }
    
    console.log('\nFull result:', result);
  } catch (error) {
    console.error('❌ Hash test failed:', error);
  }

  console.log('='.repeat(60));
}

/**
 * Set global debug hash for testing
 * 
 * Usage:
 * window.streamDebugger.setDebugHash("8gRy+i3edPABdONq...")
 * Then call testMovie("278") - it will use this hash instead of VRF
 */
export function setDebugHash(hash: string | null): void {
  if (hash) {
    window.__FLIXNEST_DEBUG_HASH = hash;
    console.log('[StreamDebugger] Debug hash SET:', hash.substring(0, 50) + '...');
    console.log('Now run testMovie() or testTV() - it will use this hash.');
  } else {
    delete window.__FLIXNEST_DEBUG_HASH;
    console.log('[StreamDebugger] Debug hash CLEARED');
  }
}

/**
 * Test vidsrcApi.getSourceByHash directly
 */
export async function testSourceApi(hash: string): Promise<void> {
  console.log('='.repeat(60));
  console.log('[StreamDebugger] Testing vidsrcApi.getSourceByHash()');
  console.log('='.repeat(60));
  
  const result = await vidsrcApi.getSourceByHash(hash, 'DirectApiTest');
  console.log('Result:', result);
  console.log('='.repeat(60));
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).streamDebugger = {
    // Extraction tests
    testMovie,
    testTV,
    runQuickTests,
    // Hash-based testing (for manual testing with Playwright-captured hashes)
    testHash,
    setDebugHash,
    testSourceApi,
    // Direct API access
    vidsrcApi,
    extractWithHash,
    streamExtractor,
    // Crypto utils
    VidsrcCrypto,
    debugDecryption,
    testDecryption,
  };
  
  console.log('[StreamDebugger] Ready! Available commands:');
  console.log('  window.streamDebugger.testMovie("278")     - Test movie extraction');
  console.log('  window.streamDebugger.testTV("1396", 1, 1) - Test TV extraction');
  console.log('  window.streamDebugger.testHash("hash...")  - Test with known hash');
  console.log('  window.streamDebugger.setDebugHash("...")  - Set global debug hash');
  console.log('  window.streamDebugger.testSourceApi("...")  - Test vidsrcApi directly');
}

/**
 * Advanced Ad Blocker Utility for iframe-embedded video players
 * 
 * Multi-layered defense system:
 * 1. Aggressive blur/focus detection and recovery
 * 2. Visibility change monitoring
 * 3. MutationObserver to remove injected ad elements
 * 4. Window count monitoring for popup detection
 * 5. Mobile-optimized event handling
 */

interface AdBlockerConfig {
  enabled: boolean;
  aggressiveness: 'low' | 'medium' | 'high';
  onAdBlocked?: () => void;
}

interface AdBlockerState {
  blockedCount: number;
  lastBlurTime: number;
  initialWindowCount: number;
  isActive: boolean;
}

const defaultConfig: AdBlockerConfig = {
  enabled: true,
  aggressiveness: 'high',
};

/**
 * Creates and returns ad blocker controls
 * Call cleanup() when component unmounts
 */
export function createAdBlocker(config: Partial<AdBlockerConfig> = {}) {
  const mergedConfig = { ...defaultConfig, ...config };
  
  const state: AdBlockerState = {
    blockedCount: 0,
    lastBlurTime: 0,
    initialWindowCount: window.length,
    isActive: false,
  };

  // Timing configurations based on aggressiveness
  const timings = {
    low: { debounce: 100, interval: 200, focusDelays: [50, 150] },
    medium: { debounce: 50, interval: 100, focusDelays: [0, 20, 50, 100] },
    high: { debounce: 10, interval: 30, focusDelays: [0, 5, 10, 20, 35, 50, 75, 100] },
  };

  const timing = timings[mergedConfig.aggressiveness];
  
  let focusInterval: ReturnType<typeof setInterval> | null = null;
  let windowCheckInterval: ReturnType<typeof setInterval> | null = null;
  let mutationObserver: MutationObserver | null = null;

  /**
   * Rapid-fire focus recovery
   * Schedules multiple focus attempts at different intervals
   */
  const rapidFocusRecovery = () => {
    // Immediate focus
    window.focus();
    
    // Scheduled focus attempts
    timing.focusDelays.forEach(delay => {
      setTimeout(() => {
        if (!document.hasFocus()) {
          window.focus();
        }
      }, delay);
    });
  };

  /**
   * Handle window blur (popup likely opened)
   */
  const handleBlur = () => {
    const now = Date.now();
    
    // Minimal debounce to prevent infinite loops
    if (now - state.lastBlurTime > timing.debounce) {
      state.lastBlurTime = now;
      state.blockedCount++;
      
      rapidFocusRecovery();
      
      if (mergedConfig.onAdBlocked) {
        mergedConfig.onAdBlocked();
      }
    }
  };

  /**
   * Handle visibility change (tab switched, likely to ad)
   */
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab was hidden - likely switched to ad tab
      rapidFocusRecovery();
      state.blockedCount++;
      
      if (mergedConfig.onAdBlocked) {
        mergedConfig.onAdBlocked();
      }
    }
  };

  /**
   * Handle page hide (mobile-specific)
   */
  const handlePageHide = () => {
    rapidFocusRecovery();
  };

  /**
   * Handle page show (returning from ad tab)
   */
  const handlePageShow = () => {
    // Ensure we have focus when returning
    setTimeout(() => window.focus(), 0);
  };

  /**
   * Proactive focus keeper - runs on interval
   */
  const startFocusInterval = () => {
    focusInterval = setInterval(() => {
      if (!document.hasFocus()) {
        window.focus();
      }
    }, timing.interval);
  };

  /**
   * Window count monitor - detects new popup windows
   */
  const startWindowMonitor = () => {
    state.initialWindowCount = window.length;
    
    windowCheckInterval = setInterval(() => {
      const currentCount = window.length;
      
      if (currentCount > state.initialWindowCount) {
        // New window detected - likely popup
        state.blockedCount++;
        rapidFocusRecovery();
        
        if (mergedConfig.onAdBlocked) {
          mergedConfig.onAdBlocked();
        }
        
        // Update baseline
        state.initialWindowCount = currentCount;
      }
    }, timing.interval * 2);
  };

  /**
   * MutationObserver to detect and remove injected ad elements
   * Monitors for suspicious iframes, scripts, and divs
   */
  const startMutationObserver = () => {
    const adPatterns = [
      /ads?[_\-\.]/i,
      /popup/i,
      /banner/i,
      /tracking/i,
      /analytics/i,
      /doubleclick/i,
      /googlesyndication/i,
      /adservice/i,
      /advertisement/i,
      /sponsor/i,
    ];

    const isAdElement = (node: Element): boolean => {
      // Check src attribute
      const src = node.getAttribute('src') || '';
      const href = node.getAttribute('href') || '';
      const id = node.getAttribute('id') || '';
      const className = node.getAttribute('class') || '';
      
      const checkString = `${src} ${href} ${id} ${className}`.toLowerCase();
      
      return adPatterns.some(pattern => pattern.test(checkString));
    };

    mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if it's an ad iframe
            if (element.tagName === 'IFRAME' && isAdElement(element)) {
              element.remove();
              state.blockedCount++;
              if (mergedConfig.onAdBlocked) {
                mergedConfig.onAdBlocked();
              }
            }
            
            // Check for ad scripts
            if (element.tagName === 'SCRIPT' && isAdElement(element)) {
              element.remove();
            }
            
            // Check for ad divs/overlays
            if (['DIV', 'SPAN', 'A'].includes(element.tagName)) {
              const style = (element as HTMLElement).style;
              // Detect overlay ads (fixed/absolute position covering screen)
              if (
                (style.position === 'fixed' || style.position === 'absolute') &&
                (style.zIndex && parseInt(style.zIndex) > 9000)
              ) {
                if (isAdElement(element)) {
                  element.remove();
                  state.blockedCount++;
                }
              }
            }
            
            // Recursively check children
            element.querySelectorAll('iframe, script').forEach(child => {
              if (isAdElement(child)) {
                child.remove();
              }
            });
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  /**
   * Override window.open in parent context
   * Won't affect iframe but catches any parent-level popups
   */
  let originalWindowOpen: typeof window.open | null = null;
  
  const overrideWindowOpen = () => {
    originalWindowOpen = window.open;
    
    window.open = function(url?: string | URL, target?: string, features?: string) {
      // Block if URL matches ad patterns
      const urlString = url?.toString() || '';
      const adUrlPatterns = [
        /ads?\./i,
        /popup/i,
        /click\./i,
        /track/i,
        /redirect/i,
      ];
      
      if (adUrlPatterns.some(pattern => pattern.test(urlString))) {
        state.blockedCount++;
        if (mergedConfig.onAdBlocked) {
          mergedConfig.onAdBlocked();
        }
        return null;
      }
      
      // Allow legitimate window.open calls
      return originalWindowOpen!.call(window, url, target, features);
    };
  };

  /**
   * Start all ad blocking mechanisms
   */
  const start = () => {
    if (!mergedConfig.enabled || state.isActive) return;
    
    state.isActive = true;
    
    // Event listeners
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    
    // Intervals
    startFocusInterval();
    startWindowMonitor();
    
    // MutationObserver
    startMutationObserver();
    
    // Window.open override
    overrideWindowOpen();
    
    console.log('[AdBlocker] Started with aggressiveness:', mergedConfig.aggressiveness);
  };

  /**
   * Stop all ad blocking mechanisms and cleanup
   */
  const cleanup = () => {
    state.isActive = false;
    
    // Remove event listeners
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('pageshow', handlePageShow);
    
    // Clear intervals
    if (focusInterval) {
      clearInterval(focusInterval);
      focusInterval = null;
    }
    if (windowCheckInterval) {
      clearInterval(windowCheckInterval);
      windowCheckInterval = null;
    }
    
    // Disconnect observer
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    
    // Restore window.open
    if (originalWindowOpen) {
      window.open = originalWindowOpen;
      originalWindowOpen = null;
    }
    
    console.log('[AdBlocker] Cleaned up. Total blocked:', state.blockedCount);
  };

  /**
   * Get current blocked count
   */
  const getBlockedCount = () => state.blockedCount;

  return {
    start,
    cleanup,
    getBlockedCount,
  };
}

/**
 * React hook for using the ad blocker
 */
export function useAdBlocker(config: Partial<AdBlockerConfig> = {}) {
  // This is just a type definition - actual hook implementation in React component
  return { start: () => {}, cleanup: () => {}, getBlockedCount: () => 0 };
}

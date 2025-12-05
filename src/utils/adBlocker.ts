/**
 * BULLETPROOF Ad Blocker for iframe-embedded video players
 *
 * Key insight from research: Mobile Chrome requires explicit user gesture
 * before popup blocking context is valid. First load doesn't count as interaction.
 *
 * Multi-layered defense system (13 layers):
 * 1. User gesture detection (CRITICAL for Mobile Chrome)
 * 2. Aggressive blur/focus detection with mobile-optimized timing
 * 3. Visibility change monitoring with bfcache support
 * 4. MutationObserver to remove injected ad elements (optimized for mobile)
 * 5. Window.open interception with fake window return
 * 6. Window count monitoring for popup detection
 * 7. Click event interception (blocks target="_blank" links)
 * 8. Auxiliary click blocking (middle-click, Ctrl+Click)
 * 9. Location navigation interception (location.href, etc.)
 * 10. beforeunload event blocking
 * 11. Form submission blocking (target="_blank" forms)
 * 12. Context menu blocking on suspicious elements
 * 13. Touch event handling for mobile link clicks
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
  userHasInteracted: boolean;
  isMobile: boolean;
}

const defaultConfig: AdBlockerConfig = {
  enabled: true,
  aggressiveness: 'high',
};

/**
 * Detect if running on mobile device
 */
const detectMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
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
    userHasInteracted: false,
    isMobile: detectMobile(),
  };

  // Timing configurations - MOBILE uses longer intervals to save battery
  const timings = {
    low: { 
      debounce: state.isMobile ? 150 : 100, 
      interval: state.isMobile ? 300 : 200, 
      focusDelays: [50, 150] 
    },
    medium: { 
      debounce: state.isMobile ? 80 : 50, 
      interval: state.isMobile ? 150 : 100, 
      focusDelays: [0, 30, 60, 100] 
    },
    high: { 
      debounce: state.isMobile ? 50 : 10, 
      interval: state.isMobile ? 100 : 30, // 100ms on mobile vs 30ms on desktop
      focusDelays: state.isMobile ? [0, 20, 50, 100, 150] : [0, 5, 10, 20, 35, 50, 75, 100] 
    },
  };

  const timing = timings[mergedConfig.aggressiveness];
  
  let focusInterval: ReturnType<typeof setInterval> | null = null;
  let windowCheckInterval: ReturnType<typeof setInterval> | null = null;
  let mutationObserver: MutationObserver | null = null;
  let originalWindowOpen: typeof window.open | null = null;
  let gestureListenersAttached = false;
  let locationDescriptors: { [key: string]: PropertyDescriptor } = {};
  let clickListenerAttached = false;
  let auxclickListenerAttached = false;
  let contextmenuListenerAttached = false;
  let touchListenerAttached = false;
  let beforeunloadListenerAttached = false;

  /**
   * Rapid-fire focus recovery
   * Only runs if user has interacted (critical for mobile)
   */
  const rapidFocusRecovery = () => {
    // On mobile, don't try to refocus before user gesture
    if (state.isMobile && !state.userHasInteracted) {
      return;
    }
    
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
   * Handle first user gesture - CRITICAL FOR MOBILE CHROME
   * Mobile Chrome doesn't recognize app-mount as valid user gesture context
   */
  const handleFirstGesture = () => {
    if (state.userHasInteracted) return;
    
    state.userHasInteracted = true;
    console.log('[AdBlocker] First user gesture detected - full protection activated');
    
    // Remove gesture listeners after first interaction
    if (gestureListenersAttached) {
      ['touchstart', 'click', 'pointerdown', 'mousedown'].forEach(event => {
        document.removeEventListener(event, handleFirstGesture, true);
      });
      gestureListenersAttached = false;
    }
  };

  /**
   * Setup gesture detection for mobile
   */
  const setupGestureDetection = () => {
    if (gestureListenersAttached) return;
    
    // Use capture phase to catch gesture BEFORE other handlers
    ['touchstart', 'click', 'pointerdown', 'mousedown'].forEach(event => {
      document.addEventListener(event, handleFirstGesture, true);
    });
    gestureListenersAttached = true;
    
    console.log('[AdBlocker] Gesture detection active (mobile mode)');
  };

  /**
   * Handle window blur (popup likely opened)
   */
  const handleBlur = () => {
    // On mobile, only intercept after user gesture
    if (state.isMobile && !state.userHasInteracted) return;
    
    const now = Date.now();
    
    // Minimal debounce to prevent infinite loops
    if (now - state.lastBlurTime > timing.debounce) {
      state.lastBlurTime = now;
      state.blockedCount++;
      
      // Slight delay for mobile processing
      setTimeout(() => {
        rapidFocusRecovery();
      }, state.isMobile ? 50 : 0);
      
      if (mergedConfig.onAdBlocked) {
        mergedConfig.onAdBlocked();
      }
    }
  };

  /**
   * Handle visibility change (tab switched, likely to ad)
   * Supports bfcache for mobile
   */
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      console.log('[AdBlocker] Page hidden');
    } else if (document.visibilityState === 'visible') {
      console.log('[AdBlocker] Page visible, checking focus');
      
      // Check if popup was opened during visibility change
      setTimeout(() => {
        if (!document.hasFocus() && state.userHasInteracted) {
          rapidFocusRecovery();
          state.blockedCount++;
          
          if (mergedConfig.onAdBlocked) {
            mergedConfig.onAdBlocked();
          }
        }
      }, state.isMobile ? 100 : 50);
    }
  };

  /**
   * Handle page hide - bfcache support (mobile-critical)
   */
  const handlePageHide = (event: PageTransitionEvent) => {
    if (event.persisted) {
      console.log('[AdBlocker] Page entering bfcache');
    }
    rapidFocusRecovery();
  };

  /**
   * Handle page show - restore from bfcache (mobile-critical)
   */
  const handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      console.log('[AdBlocker] Page restored from bfcache, re-initializing');
      // Re-attach gesture listeners if needed
      if (state.isMobile && !state.userHasInteracted) {
        setupGestureDetection();
      }
    }
    // Ensure we have focus when returning
    setTimeout(() => window.focus(), 0);
  };

  /**
   * Proactive focus keeper - runs on interval
   */
  const startFocusInterval = () => {
    focusInterval = setInterval(() => {
      // On mobile, only check after user gesture
      if (state.isMobile && !state.userHasInteracted) return;
      
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
   * Check if element matches ad patterns
   */
  const isAdElement = (node: Element): boolean => {
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
      /taboola/i,
      /outbrain/i,
    ];

    const src = node.getAttribute('src') || '';
    const href = node.getAttribute('href') || '';
    const id = node.getAttribute('id') || '';
    const className = node.getAttribute('class') || '';
    
    const checkString = `${src} ${href} ${id} ${className}`.toLowerCase();
    
    return adPatterns.some(pattern => pattern.test(checkString));
  };

  /**
   * MutationObserver to detect and remove injected ad elements
   * OPTIMIZED for mobile: skip characterData monitoring
   */
  const startMutationObserver = () => {
    mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        // Check added nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if it's an ad iframe
            if (element.tagName === 'IFRAME' && isAdElement(element)) {
              console.log('[AdBlocker] Removing ad iframe');
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

        // Check attribute changes (ad attribute injection)
        if (mutation.type === 'attributes') {
          const attrName = mutation.attributeName;
          const element = mutation.target as HTMLElement;

          // Remove malicious event handlers
          if (attrName === 'onclick' || attrName === 'onload' || attrName === 'onerror') {
            element.removeAttribute(attrName);
          }

          // Remove target="_blank" from suspicious links/forms
          if (attrName === 'target') {
            const target = element.getAttribute('target');
            if (target === '_blank' || target === '_new') {
              if (element.tagName === 'A') {
                const href = element.getAttribute('href') || '';
                if (isBlockedNavigation(href, element)) {
                  element.removeAttribute('target');
                  console.log('[AdBlocker] Removed dynamically added target="_blank"');
                  state.blockedCount++;
                }
              } else if (element.tagName === 'FORM') {
                const action = element.getAttribute('action') || '';
                if (isBlockedNavigation(action)) {
                  element.removeAttribute('target');
                  console.log('[AdBlocker] Removed target from form');
                  state.blockedCount++;
                }
              }
            }
          }
        }
      });
    });

    // MOBILE OPTIMIZATION: Don't monitor characterData (text nodes)
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['onclick', 'onload', 'onerror', 'src', 'target', 'href', 'action'],
      attributeOldValue: false,
      characterData: false, // Important: Don't monitor text nodes on mobile
    });
  };

  /**
   * Override window.open in parent context
   * Returns fake window object to prevent errors in ad scripts
   */
  const overrideWindowOpen = () => {
    originalWindowOpen = window.open;
    
    window.open = function(url?: string | URL, target?: string, features?: string) {
      const urlString = url?.toString() || '';
      
      // Block empty popups
      if (!urlString) {
        console.log('[AdBlocker] Blocked empty popup');
        state.blockedCount++;
        return createFakeWindow();
      }
      
      // Block if URL matches ad patterns
      const adUrlPatterns = [
        /ads?\./i,
        /popup/i,
        /click\./i,
        /track/i,
        /redirect/i,
        /doubleclick/i,
        /googlesyndication/i,
        /amazon-adsystem/i,
        /taboola/i,
        /outbrain/i,
      ];
      
      if (adUrlPatterns.some(pattern => pattern.test(urlString))) {
        console.log('[AdBlocker] Blocked popup:', urlString.substring(0, 50));
        state.blockedCount++;
        if (mergedConfig.onAdBlocked) {
          mergedConfig.onAdBlocked();
        }
        return createFakeWindow();
      }
      
      // Allow legitimate window.open calls
      return originalWindowOpen!.call(window, url, target, features);
    };
  };

  /**
   * Create fake window object to prevent errors in ad scripts
   */
  const createFakeWindow = (): Window => {
    return {
      closed: true,
      focus: () => {},
      blur: () => {},
      close: () => {},
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    } as unknown as Window;
  };

  /**
   * Check if URL or element looks like ad/popup
   */
  const isBlockedNavigation = (url: string, element?: HTMLElement): boolean => {
    const suspiciousPatterns = [
      /ads?\./i,
      /popup/i,
      /click\./i,
      /track/i,
      /redirect/i,
      /doubleclick/i,
      /googlesyndication/i,
      /amazon-adsystem/i,
      /taboola/i,
      /outbrain/i,
      /adservice/i,
      /affiliate/i,
      /promo/i,
      /banner/i,
    ];

    // Check URL
    if (suspiciousPatterns.some(pattern => pattern.test(url))) {
      return true;
    }

    // Check element attributes if provided
    if (element) {
      const className = element.className || '';
      const id = element.id || '';
      const checkString = `${className} ${id}`.toLowerCase();
      if (suspiciousPatterns.some(pattern => pattern.test(checkString))) {
        return true;
      }
    }

    // Block external domains that aren't video streaming
    try {
      const urlObj = new URL(url, window.location.href);
      const currentHost = window.location.hostname;
      const targetHost = urlObj.hostname;

      // Allow same domain and known video sources
      const allowedDomains = ['vidsrc.cc', 'vidsrc.to', 'vidsrc.me', currentHost];
      const isAllowed = allowedDomains.some(domain =>
        targetHost === domain || targetHost.endsWith('.' + domain)
      );

      // If different domain and not allowed, it's likely an ad
      if (!isAllowed && targetHost !== currentHost) {
        return true;
      }
    } catch (e) {
      // Invalid URL, block it
      return true;
    }

    return false;
  };

  /**
   * LAYER 7: Click event interception
   * Blocks links with target="_blank" and suspicious URLs
   */
  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link) {
      const href = link.getAttribute('href') || '';
      const targetAttr = link.getAttribute('target');

      // Block if target="_blank" or suspicious URL
      if (targetAttr === '_blank' || targetAttr === '_new') {
        if (isBlockedNavigation(href, link)) {
          console.log('[AdBlocker] Blocked target="_blank" link:', href.substring(0, 50));
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          state.blockedCount++;
          if (mergedConfig.onAdBlocked) {
            mergedConfig.onAdBlocked();
          }
          return false;
        }
      }

      // Block if opens new window through any means
      if (href && (href.startsWith('javascript:') || isBlockedNavigation(href, link))) {
        console.log('[AdBlocker] Blocked suspicious link:', href.substring(0, 50));
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        state.blockedCount++;
        if (mergedConfig.onAdBlocked) {
          mergedConfig.onAdBlocked();
        }
        return false;
      }
    }

    return true;
  };

  /**
   * LAYER 8: Auxiliary click blocking (middle-click, Ctrl+Click)
   */
  const handleAuxClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link) {
      const href = link.getAttribute('href') || '';

      // Block middle-click or modified clicks on suspicious links
      if (event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey) {
        if (isBlockedNavigation(href, link)) {
          console.log('[AdBlocker] Blocked auxclick/modified click');
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          state.blockedCount++;
          if (mergedConfig.onAdBlocked) {
            mergedConfig.onAdBlocked();
          }
          return false;
        }
      }
    }
  };

  /**
   * LAYER 9: Location navigation interception
   */
  const interceptLocationNavigation = () => {
    const locationProperties = ['href', 'pathname', 'search', 'hash'];

    locationProperties.forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(Location.prototype, prop);
      if (descriptor && descriptor.set) {
        locationDescriptors[prop] = descriptor;

        Object.defineProperty(window.location, prop, {
          set: function(value: any) {
            const newUrl = prop === 'href' ? value : window.location.origin + value;

            if (isBlockedNavigation(newUrl)) {
              console.log('[AdBlocker] Blocked location navigation:', newUrl.substring(0, 50));
              state.blockedCount++;
              if (mergedConfig.onAdBlocked) {
                mergedConfig.onAdBlocked();
              }
              return;
            }

            // Allow legitimate navigation
            if (descriptor.set) {
              descriptor.set.call(this, value);
            }
          },
          get: descriptor.get,
          configurable: true,
          enumerable: true,
        });
      }
    });

    // Intercept location.replace and location.assign
    const originalReplace = window.location.replace;
    const originalAssign = window.location.assign;

    window.location.replace = function(url: string) {
      if (isBlockedNavigation(url)) {
        console.log('[AdBlocker] Blocked location.replace:', url.substring(0, 50));
        state.blockedCount++;
        if (mergedConfig.onAdBlocked) {
          mergedConfig.onAdBlocked();
        }
        return;
      }
      return originalReplace.call(this, url);
    };

    window.location.assign = function(url: string) {
      if (isBlockedNavigation(url)) {
        console.log('[AdBlocker] Blocked location.assign:', url.substring(0, 50));
        state.blockedCount++;
        if (mergedConfig.onAdBlocked) {
          mergedConfig.onAdBlocked();
        }
        return;
      }
      return originalAssign.call(this, url);
    };
  };

  /**
   * LAYER 10: beforeunload blocking
   */
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    // Only block if we haven't explicitly navigated away
    if (state.userHasInteracted && !document.activeElement?.matches('a, button')) {
      console.log('[AdBlocker] Blocked beforeunload redirect');
      event.preventDefault();
      event.returnValue = '';
      state.blockedCount++;
      if (mergedConfig.onAdBlocked) {
        mergedConfig.onAdBlocked();
      }
    }
  };

  /**
   * LAYER 11: Form submission blocking
   */
  const handleFormSubmit = (event: Event) => {
    const form = event.target as HTMLFormElement;
    const target = form.getAttribute('target');
    const action = form.getAttribute('action') || '';

    if ((target === '_blank' || target === '_new') && isBlockedNavigation(action)) {
      console.log('[AdBlocker] Blocked form submission');
      event.preventDefault();
      event.stopPropagation();
      state.blockedCount++;
      if (mergedConfig.onAdBlocked) {
        mergedConfig.onAdBlocked();
      }
    }
  };

  /**
   * LAYER 12: Context menu blocking on suspicious elements
   */
  const handleContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link) {
      const href = link.getAttribute('href') || '';
      if (isBlockedNavigation(href, link)) {
        console.log('[AdBlocker] Blocked context menu on suspicious link');
        event.preventDefault();
        state.blockedCount++;
      }
    }
  };

  /**
   * LAYER 13: Touch event handling for mobile
   */
  const handleTouchEnd = (event: TouchEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link) {
      const href = link.getAttribute('href') || '';
      const targetAttr = link.getAttribute('target');

      if ((targetAttr === '_blank' || targetAttr === '_new') && isBlockedNavigation(href, link)) {
        console.log('[AdBlocker] Blocked touch on target="_blank" link');
        event.preventDefault();
        event.stopPropagation();
        state.blockedCount++;
        if (mergedConfig.onAdBlocked) {
          mergedConfig.onAdBlocked();
        }
      }
    }
  };

  /**
   * Remove target="_blank" and suspicious attributes from all links and forms
   */
  const sanitizeDOM = () => {
    // Sanitize all existing links
    document.querySelectorAll('a[target="_blank"], a[target="_new"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (isBlockedNavigation(href, link as HTMLElement)) {
        link.removeAttribute('target');
        console.log('[AdBlocker] Removed target from suspicious link');
      }
    });

    // Sanitize all forms
    document.querySelectorAll('form[target="_blank"], form[target="_new"]').forEach(form => {
      const action = form.getAttribute('action') || '';
      if (isBlockedNavigation(action)) {
        form.removeAttribute('target');
        console.log('[AdBlocker] Removed target from suspicious form');
      }
    });

    // Remove meta refresh tags
    document.querySelectorAll('meta[http-equiv="refresh"]').forEach(meta => {
      const content = meta.getAttribute('content') || '';
      if (content && content.includes('url=')) {
        meta.remove();
        console.log('[AdBlocker] Removed meta refresh tag');
      }
    });

    // Remove base target
    document.querySelectorAll('base[target]').forEach(base => {
      base.removeAttribute('target');
      console.log('[AdBlocker] Removed base target');
    });
  };

  /**
   * Start all ad blocking mechanisms
   */
  const start = () => {
    if (!mergedConfig.enabled || state.isActive) return;

    state.isActive = true;

    // CRITICAL FOR MOBILE: Setup gesture detection first
    if (state.isMobile) {
      setupGestureDetection();
    } else {
      // On desktop, mark as interacted immediately
      state.userHasInteracted = true;
    }

    // LAYER 1-6: Original event listeners (capture phase for priority)
    window.addEventListener('blur', handleBlur, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide as EventListener);
    window.addEventListener('pageshow', handlePageShow as EventListener);

    // LAYER 7: Click interception (capture phase - CRITICAL)
    if (!clickListenerAttached) {
      document.addEventListener('click', handleClick, true);
      clickListenerAttached = true;
    }

    // LAYER 8: Auxiliary click blocking (middle-click, Ctrl+Click)
    if (!auxclickListenerAttached) {
      document.addEventListener('auxclick', handleAuxClick, true);
      document.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button === 1) handleAuxClick(e);
      }, true);
      auxclickListenerAttached = true;
    }

    // LAYER 9: Location navigation interception
    interceptLocationNavigation();

    // LAYER 10: beforeunload blocking
    if (!beforeunloadListenerAttached) {
      window.addEventListener('beforeunload', handleBeforeUnload, true);
      beforeunloadListenerAttached = true;
    }

    // LAYER 11: Form submission blocking
    document.addEventListener('submit', handleFormSubmit, true);

    // LAYER 12: Context menu blocking
    if (!contextmenuListenerAttached) {
      document.addEventListener('contextmenu', handleContextMenu, true);
      contextmenuListenerAttached = true;
    }

    // LAYER 13: Touch event handling (mobile)
    if (state.isMobile && !touchListenerAttached) {
      document.addEventListener('touchend', handleTouchEnd, true);
      touchListenerAttached = true;
    }

    // Intervals
    startFocusInterval();
    startWindowMonitor();

    // MutationObserver
    if (document.body) {
      startMutationObserver();
    } else {
      // Wait for body to be available
      document.addEventListener('DOMContentLoaded', startMutationObserver);
    }

    // Window.open override - always active
    overrideWindowOpen();

    // Sanitize DOM immediately
    if (document.body) {
      sanitizeDOM();
      // Re-sanitize periodically as ads inject dynamically
      setInterval(sanitizeDOM, timing.interval * 3);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        sanitizeDOM();
        setInterval(sanitizeDOM, timing.interval * 3);
      });
    }

    console.log('[AdBlocker] BULLETPROOF mode started (13 layers):', {
      aggressiveness: mergedConfig.aggressiveness,
      isMobile: state.isMobile,
      interval: timing.interval + 'ms',
    });
  };

  /**
   * Stop all ad blocking mechanisms and cleanup
   */
  const cleanup = () => {
    state.isActive = false;

    // Remove LAYER 1-6 event listeners
    window.removeEventListener('blur', handleBlur, true);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide as EventListener);
    window.removeEventListener('pageshow', handlePageShow as EventListener);

    // Remove LAYER 7: Click listener
    if (clickListenerAttached) {
      document.removeEventListener('click', handleClick, true);
      clickListenerAttached = false;
    }

    // Remove LAYER 8: Auxclick listeners
    if (auxclickListenerAttached) {
      document.removeEventListener('auxclick', handleAuxClick, true);
      auxclickListenerAttached = false;
    }

    // Remove LAYER 10: beforeunload listener
    if (beforeunloadListenerAttached) {
      window.removeEventListener('beforeunload', handleBeforeUnload, true);
      beforeunloadListenerAttached = false;
    }

    // Remove LAYER 11: Form submission listener
    document.removeEventListener('submit', handleFormSubmit, true);

    // Remove LAYER 12: Context menu listener
    if (contextmenuListenerAttached) {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      contextmenuListenerAttached = false;
    }

    // Remove LAYER 13: Touch listener
    if (touchListenerAttached) {
      document.removeEventListener('touchend', handleTouchEnd, true);
      touchListenerAttached = false;
    }

    // Remove gesture listeners if still attached
    if (gestureListenersAttached) {
      ['touchstart', 'click', 'pointerdown', 'mousedown'].forEach(event => {
        document.removeEventListener(event, handleFirstGesture, true);
      });
      gestureListenersAttached = false;
    }

    // LAYER 9: Restore location properties
    Object.keys(locationDescriptors).forEach(prop => {
      const descriptor = locationDescriptors[prop];
      if (descriptor) {
        Object.defineProperty(window.location, prop, descriptor);
      }
    });
    locationDescriptors = {};

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

  /**
   * Check if user has interacted (for debugging)
   */
  const hasUserInteracted = () => state.userHasInteracted;

  return {
    start,
    cleanup,
    getBlockedCount,
    hasUserInteracted,
  };
}

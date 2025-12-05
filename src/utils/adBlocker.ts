/**
 * ULTRA-AGGRESSIVE Ad Blocker - Blocks EVERY popup technique
 *
 * CRITICAL INSIGHTS:
 * 1. Ads exploit "first click" - browsers allow ONE popup per user gesture
 * 2. Ads attach listeners BEFORE our code runs (in iframes)
 * 3. Mobile Chrome's popup blocker is weaker than desktop
 * 4. Download dialogs (blob:, data:, download attribute) bypass normal blocking
 * 5. Timing attacks - ads wait 10-100ms after click to open popup
 *
 * DEFENSE STRATEGY:
 * - Override window.open IMMEDIATELY (before any other script)
 * - Block ALL window.open calls unless to whitelisted video domains
 * - Intercept clicks in CAPTURE phase with IMMEDIATE preventDefault
 * - Block downloads (blob:, data:, download attribute)
 * - Prevent iframe click hijacking with transparent overlay
 * - Track timing - block popups within 200ms of ANY user interaction
 * - Mobile: Aggressive touchstart/touchend interception
 */

interface AdBlockerConfig {
  enabled: boolean;
  aggressiveness: 'low' | 'medium' | 'high' | 'extreme';
  onAdBlocked?: () => void;
}

interface AdBlockerState {
  blockedCount: number;
  lastInteractionTime: number;
  initialWindowCount: number;
  isActive: boolean;
  userHasInteracted: boolean;
  isMobile: boolean;
  clickCount: number;
  lastClickTarget: EventTarget | null;
  popupDetectedCallback?: () => void;
  windowOpened: number;
  lastWindowCheckTime: number;
  lastBlockedUrl?: string;
}

const defaultConfig: AdBlockerConfig = {
  enabled: true,
  aggressiveness: 'extreme', // MAXIMUM protection by default
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
 * Check if URL is a whitelisted video streaming domain
 * ONLY these domains are allowed for window.open
 */
const isWhitelistedVideoURL = (url: string): boolean => {
  try {
    const urlObj = new URL(url, window.location.href);
    const hostname = urlObj.hostname.toLowerCase();

    // ONLY allow video streaming domains
    const whitelistedDomains = [
      'vidsrc.cc',
      'vidsrc.to',
      'vidsrc.me',
      'vidsrc.net',
      'vidsrc.xyz',
    ];

    return whitelistedDomains.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
};

/**
 * Check if URL is suspicious (ad/tracking/redirect)
 */
const isSuspiciousURL = (url: string): boolean => {
  if (!url || url === 'about:blank' || url === '') return true;

  const suspiciousPatterns = [
    /ads?[_\-\.]/i,
    /popup/i,
    /click/i,
    /track/i,
    /redirect/i,
    /doubleclick/i,
    /googlesyndication/i,
    /adservice/i,
    /banner/i,
    /promo/i,
    /affiliate/i,
    /adcash/i,
    /voluum/i,
    /betting/i,
    /casino/i,
    /rajbets/i,
    /rajbet/i,
    /bojel\.com/i,
    /afu\.php/i,
    /zrlqm\.com/i,
    /lizalive\.com/i,
    /prmtracking\.com/i,
    /opera\.com/i,
    /features\/spotify/i,
    /partner.*opera/i,
    /offer_id=\d+/i,
    /sub\d=/i,
    /download/i,
    /setup\.exe/i,
    /\.apk$/i,
    /\.exe$/i,
    /\.msi$/i,
    /\.dmg$/i,
    /\.pkg$/i,
    /\.zip$/i,
    /\.rar$/i,
    /\.7z$/i,
    /\.gz$/i,
    /opera\.com\/partner/i,
    /opera\.com\/gx/i,
    /opera\.com\/features/i,
    /opera.*download/i,
    /opera.*setup/i,
    /utm_campaign=449798220/i,
    /utm_source=adcash/i,
    /utm_medium=pb/i,
    /utm_medium=partner/i,
    /m\.88funinr\.com/i,
    /88funinr\.com/i,
    /browser.*setup/i,
    /install.*browser/i,
    /get.*opera/i,
    /1xbet/i,
    /betway/i,
    /parimatch/i,
    /\.top$/i,
    /\.xyz$/i,
    /\.club$/i,
    /zoneid=\d+/i,
    /ymid=/i,
    /rid=/i,
    /rhd=/i,
    /os_version=/i,
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(url))) {
    return true;
  }

  // Block blob: and data: URLs (used for downloads)
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return true;
  }

  return false;
};

/**
 * URLs that should trigger immediate paranoia and hard blocking
 */
const isParanoiaURL = (url: string): boolean => {
  const paranoiaPatterns = [
    /prmtracking\.com/i,
    /adcash/i,
    /voluum/i,
    /afu\.php/i,
    /opera\.com\/partner/i,
    /opera\.com\/features/i,
    /opera\.com\/gx/i,
    /opera\.com/i,
    /opera.*download/i,
    /opera.*setup/i,
    /lizalive\.com/i,
    /zrlqm\.com/i,
    /bojel\.com/i,
    /88funinr\.com/i,
    /m\.88funinr\.com/i,
  ];

  return paranoiaPatterns.some(p => p.test(url));
};

/**
 * Creates and returns ad blocker controls
 */
export function createAdBlocker(config: Partial<AdBlockerConfig> = {}) {
  const mergedConfig = { ...defaultConfig, ...config };

  const state: AdBlockerState = {
    blockedCount: 0,
    lastInteractionTime: 0,
    initialWindowCount: window.length,
    isActive: false,
    userHasInteracted: false,
    isMobile: detectMobile(),
    clickCount: 0,
    lastClickTarget: null,
    popupDetectedCallback: config.onAdBlocked,
    windowOpened: 0,
    lastWindowCheckTime: Date.now(),
  };

  /**
   * Centralized blocker notification to fan-out to UI and click shield
   */
  const reportBlock = (reason: string, url?: string) => {
    state.blockedCount++;
    state.lastBlockedUrl = url;
    if (mergedConfig.onAdBlocked) mergedConfig.onAdBlocked();

    // Broadcast so Player/click shield can respond immediately
    try {
      window.dispatchEvent(
        new CustomEvent('adblocker-popup', {
          detail: { reason, url },
        })
      );
    } catch {
      // Ignore if CustomEvent not available
    }
  };

  // Timing configurations - EXTREME mode is most aggressive
  const timings = {
    low: { debounce: 500, interval: 300, suspiciousWindow: 1000 },
    medium: { debounce: 200, interval: 150, suspiciousWindow: 500 },
    high: { debounce: 100, interval: 50, suspiciousWindow: 300 },
    extreme: { debounce: 10, interval: 20, suspiciousWindow: 350 },
  };

  const timing = timings[mergedConfig.aggressiveness];

  let focusInterval: ReturnType<typeof setInterval> | null = null;
  let windowCheckInterval: ReturnType<typeof setInterval> | null = null;
  let mutationObserver: MutationObserver | null = null;
  let originalWindowOpen: typeof window.open | null = null;
  let sanitizeInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * CRITICAL: Override window.open IMMEDIATELY and AGGRESSIVELY
   * This is the FIRST line of defense against popups
   */
  const overrideWindowOpen = () => {
    // Save original
    originalWindowOpen = window.open;

    // Override with AGGRESSIVE blocking
    window.open = function(url?: string | URL, target?: string, features?: string): Window | null {
      const urlString = url?.toString() || '';
      const now = Date.now();

      // RULE 1: Block empty/blank popups (always suspicious)
      if (!urlString || urlString === 'about:blank') {
        console.log('[AdBlocker] ❌ Blocked empty popup');
        reportBlock('empty-popup', urlString);
        return createFakeWindow();
      }

      // RULE 2: Block suspicious URLs (ads, betting sites, downloads)
      if (isSuspiciousURL(urlString)) {
        console.log('[AdBlocker] ❌ Blocked suspicious popup:', urlString.substring(0, 60));
        reportBlock('suspicious-url', urlString);
        if (isParanoiaURL(urlString)) {
          reportBlock('paranoia-url', urlString);
        }
        return createFakeWindow();
      }

      // RULE 2b: Paranoia-only patterns (block even if not caught above)
      if (isParanoiaURL(urlString)) {
        console.log('[AdBlocker] ❌ Blocked paranoia popup:', urlString.substring(0, 60));
        reportBlock('paranoia-url', urlString);
        return createFakeWindow();
      }

      // RULE 3: TIMING ATTACK PREVENTION
      // Block ANY popup opened within 200ms of user interaction
      // (Ads exploit the "genuine gesture" window)
      const timeSinceInteraction = now - state.lastInteractionTime;
      if (timeSinceInteraction < timing.suspiciousWindow) {
        // Only allow whitelisted video domains during this window
        if (!isWhitelistedVideoURL(urlString)) {
          console.log('[AdBlocker] ⏱️ Blocked timing attack popup:', urlString.substring(0, 60));
          reportBlock('timing-attack', urlString);
          return createFakeWindow();
        }
      }

      // RULE 4: Block non-whitelisted external domains
      try {
        const urlObj = new URL(urlString, window.location.href);
        const currentHost = window.location.hostname;
        const targetHost = urlObj.hostname;

        // Block if not same domain and not whitelisted video source
        if (targetHost !== currentHost && !isWhitelistedVideoURL(urlString)) {
          console.log('[AdBlocker] 🌐 Blocked external popup:', urlString.substring(0, 60));
          reportBlock('external-popup', urlString);
          if (isParanoiaURL(urlString)) {
            reportBlock('paranoia-url', urlString);
          }
          return createFakeWindow();
        }
      } catch (e) {
        // Invalid URL - block it
        console.log('[AdBlocker] ⚠️ Blocked invalid URL popup');
        reportBlock('invalid-url');
        return createFakeWindow();
      }

      // If we get here, it's likely legitimate
      console.log('[AdBlocker] ✅ Allowing legitimate window.open:', urlString.substring(0, 60));
      return originalWindowOpen!.call(window, url, target, features);
    };
  };

  /**
   * Create fake window object for blocked popups
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
      location: { href: '' } as any,
      document: {} as any,
    } as unknown as Window;
  };

  /**
   * ULTRA-AGGRESSIVE click interception
   * This MUST run in capture phase BEFORE any ad script
   */
  const handleClick = (event: MouseEvent | TouchEvent) => {
    // Update interaction time for timing attack prevention
    state.lastInteractionTime = Date.now();
    state.userHasInteracted = true;
    state.clickCount++;

    const target = event.target as HTMLElement;
    state.lastClickTarget = target;

    // Check if clicking on a link
    const link = target.closest('a');
    if (link) {
      const href = link.getAttribute('href') || '';
      const targetAttr = link.getAttribute('target');
      const download = link.getAttribute('download');

      // BLOCK: Download attribute (Opera setup, APK downloads)
      if (download !== null) {
        console.log('[AdBlocker] 📥 Blocked download link:', href.substring(0, 60));
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        reportBlock('download-attribute', href);
        return;
      }

      // BLOCK: Suspicious URLs (rajbets.com, etc.)
      if (isSuspiciousURL(href)) {
        console.log('[AdBlocker] 🔗 Blocked suspicious link:', href.substring(0, 60));
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        reportBlock('suspicious-link', href);
        if (isParanoiaURL(href)) {
          reportBlock('paranoia-link', href);
        }
        return;
      }

      // BLOCK: target="_blank" to non-whitelisted domains
      if (targetAttr === '_blank' || targetAttr === '_new') {
        if (!isWhitelistedVideoURL(href) && href !== '' && !href.startsWith('#')) {
          console.log('[AdBlocker] 🎯 Blocked target="_blank" link:', href.substring(0, 60));
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          reportBlock('target-blank', href);
          return;
        }
      }

      // BLOCK: javascript: protocol
      if (href.startsWith('javascript:')) {
        console.log('[AdBlocker] ⚡ Blocked javascript: protocol');
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        reportBlock('javascript-protocol', href);
        return;
      }
    }
  };

  /**
   * Auxiliary click blocking (middle-click, Ctrl+Click)
   */
  const handleAuxClick = (event: MouseEvent) => {
    state.lastInteractionTime = Date.now();

    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link) {
      const href = link.getAttribute('href') || '';

      // Block if suspicious or non-whitelisted
      if (isSuspiciousURL(href) || !isWhitelistedVideoURL(href)) {
        console.log('[AdBlocker] 🖱️ Blocked auxclick');
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        reportBlock('auxclick', href);
        if (isParanoiaURL(href)) {
          reportBlock('paranoia-link', href);
        }
      }
    }
  };

  /**
   * Context menu blocking on suspicious elements
   */
  const handleContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link) {
      const href = link.getAttribute('href') || '';
      if (isSuspiciousURL(href)) {
        event.preventDefault();
        reportBlock('contextmenu', href);
      }
    }
  };

  /**
   * Prevent first-click popup hijacking
   */
  const preventFirstClickHijack = (event: Event) => {
    // On first few clicks, be EXTRA aggressive
    if (state.clickCount < 3) {
      state.lastInteractionTime = Date.now();
      console.log('[AdBlocker] 🛡️ First-click protection active');
    }
  };

  /**
   * Sanitize DOM - remove suspicious elements
   */
  const sanitizeDOM = () => {
    // Remove all download attributes
    document.querySelectorAll('a[download]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (isSuspiciousURL(href)) {
        link.removeAttribute('download');
        console.log('[AdBlocker] 🧹 Removed download attribute');
      }
    });

    // Remove target="_blank" from suspicious links
    document.querySelectorAll('a[target="_blank"], a[target="_new"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (isSuspiciousURL(href) || (!isWhitelistedVideoURL(href) && href !== '' && !href.startsWith('#'))) {
        link.removeAttribute('target');
        console.log('[AdBlocker] 🧹 Removed target="_blank"');
      }
    });

    // Strip href entirely for obviously malicious targets
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (isSuspiciousURL(href)) {
        link.removeAttribute('href');
        link.removeAttribute('download');
        console.log('[AdBlocker] 🧹 Removed malicious href');
        reportBlock('sanitize-href', href);
      } else if (isParanoiaURL(href)) {
        link.removeAttribute('href');
        link.removeAttribute('download');
        console.log('[AdBlocker] 🧹 Removed paranoia href');
        reportBlock('paranoia-href', href);
      }
    });

    // Remove meta refresh
    document.querySelectorAll('meta[http-equiv="refresh"]').forEach(meta => {
      meta.remove();
      console.log('[AdBlocker] 🧹 Removed meta refresh');
    });
  };

  /**
   * Window count monitoring - detects if new windows/popups opened
   */
  const checkWindowCount = () => {
    const currentWindowCount = window.length;
    if (currentWindowCount > state.initialWindowCount) {
      console.log('[AdBlocker] 🪟 New window detected!');
      state.initialWindowCount = currentWindowCount;
      reportBlock('window-count');
    }
  };

  /**
   * Blur/focus detection - ENHANCED with popup callback
   */
  const handleBlur = () => {
    const now = Date.now();
    const timeSinceInteraction = now - state.lastInteractionTime;

    // CRITICAL: If blur happens within suspicious window, it's likely a popup
    if (timeSinceInteraction < timing.suspiciousWindow) {
      console.log('[AdBlocker] 👁️ Window blur detected - POPUP LIKELY - refocusing');

      // Check window count
      checkWindowCount();

      setTimeout(() => {
        window.focus();
        reportBlock('blur-popup');
      }, 10);
    }
  };

  /**
   * Visibility change detection - ENHANCED
   */
  const handleVisibilityChange = () => {
    if (document.hidden) {
      const timeSinceInteraction = Date.now() - state.lastInteractionTime;
      if (timeSinceInteraction < timing.suspiciousWindow) {
        console.log('[AdBlocker] 👁️ Tab hidden after interaction - POPUP DETECTED - refocusing');

        // Check window count
        checkWindowCount();

        setTimeout(() => {
          window.focus();
          reportBlock('visibility-popup');
        }, 10);
      }
    }
  };

  /**
   * beforeunload detection - prevent iframe navigation hijacking
   */
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    const now = Date.now();
    const timeSinceInteraction = now - state.lastInteractionTime;

    // If unload happens shortly after interaction, it might be ad redirect
    if (timeSinceInteraction < timing.suspiciousWindow) {
      console.log('[AdBlocker] ⚠️ Suspicious beforeunload detected');
      reportBlock('beforeunload');
    }
  };

  /**
   * Start all protection mechanisms
   */
  const start = () => {
    if (!mergedConfig.enabled || state.isActive) return;

    state.isActive = true;

    console.log('[AdBlocker] 🚀 Starting ULTRA-AGGRESSIVE protection:', {
      mode: mergedConfig.aggressiveness,
      isMobile: state.isMobile,
      suspiciousWindow: timing.suspiciousWindow + 'ms',
    });

    // CRITICAL: Override window.open IMMEDIATELY
    overrideWindowOpen();

    // AGGRESSIVE: Intercept ALL clicks in capture phase
    // This runs BEFORE any ad script can hijack clicks
    document.addEventListener('click', handleClick, true);
    document.addEventListener('click', preventFirstClickHijack, true);

    // Mobile: Intercept touch events
    if (state.isMobile) {
      document.addEventListener('touchstart', handleClick as any, true);
      document.addEventListener('touchend', handleClick as any, true);
    }

    // Auxiliary clicks (middle-click, Ctrl+Click)
    document.addEventListener('auxclick', handleAuxClick, true);
    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1) handleAuxClick(e);
    }, true);

    // Context menu blocking
    document.addEventListener('contextmenu', handleContextMenu, true);

    // Blur/focus detection
    window.addEventListener('blur', handleBlur, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // beforeunload detection
    window.addEventListener('beforeunload', handleBeforeUnload, true);

    // Sanitize DOM immediately and periodically
    if (document.body) {
      sanitizeDOM();
      sanitizeInterval = setInterval(sanitizeDOM, timing.interval * 10);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        sanitizeDOM();
        sanitizeInterval = setInterval(sanitizeDOM, timing.interval * 10);
      });
    }

    // Proactive focus keeper + window count monitor
    focusInterval = setInterval(() => {
      if (!document.hasFocus()) {
        const timeSinceInteraction = Date.now() - state.lastInteractionTime;
        if (timeSinceInteraction < timing.suspiciousWindow * 2) {
          window.focus();
        }
      }

      // Check window count periodically
      checkWindowCount();
    }, timing.interval);

    // Periodic window count check (more frequent for extreme mode)
    windowCheckInterval = setInterval(() => {
      checkWindowCount();
    }, timing.interval * 5);

    console.log('[AdBlocker] ✅ Ultra-aggressive protection ACTIVE');
  };

  /**
   * Cleanup
   */
  const cleanup = () => {
    state.isActive = false;

    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('click', preventFirstClickHijack, true);
    document.removeEventListener('auxclick', handleAuxClick, true);
    document.removeEventListener('contextmenu', handleContextMenu, true);
    window.removeEventListener('blur', handleBlur, true);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload, true);

    if (state.isMobile) {
      document.removeEventListener('touchstart', handleClick as any, true);
      document.removeEventListener('touchend', handleClick as any, true);
    }

    if (focusInterval) {
      clearInterval(focusInterval);
      focusInterval = null;
    }

    if (windowCheckInterval) {
      clearInterval(windowCheckInterval);
      windowCheckInterval = null;
    }

    if (sanitizeInterval) {
      clearInterval(sanitizeInterval);
      sanitizeInterval = null;
    }

    if (originalWindowOpen) {
      window.open = originalWindowOpen;
      originalWindowOpen = null;
    }

    console.log('[AdBlocker] 🛑 Cleaned up. Total blocked:', state.blockedCount);
  };

  const getBlockedCount = () => state.blockedCount;
  const hasUserInteracted = () => state.userHasInteracted;

  return {
    start,
    cleanup,
    getBlockedCount,
    hasUserInteracted,
  };
}

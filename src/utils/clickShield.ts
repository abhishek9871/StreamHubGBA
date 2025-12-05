/**
 * INTELLIGENT CLICK SHIELD SYSTEM
 *
 * Purpose: Protect video player from ad popups without custom controls
 *
 * Strategy:
 * 1. Time-based gating: Block clicks during dangerous periods
 * 2. Adaptive trust system: Learn from user behavior
 * 3. Popup detection integration: Reset protection on popup attempts
 * 4. Mobile optimization: Enhanced protection for touch devices
 *
 * This shield sits OVER the iframe and intelligently decides when to
 * block vs allow clicks to pass through to the vidsrc player.
 */

export interface ClickShieldConfig {
  enabled: boolean;
  isMobile: boolean;
  onPopupDetected?: () => void;
  onTrustLevelChanged?: (level: number) => void;
}

export interface ClickShieldState {
  // Timing
  pageLoadTime: number;
  iframeLoadTime: number;
  lastClickTime: number;
  lastPopupDetectedTime: number;
  paranoiaUntil: number;

  // Click tracking
  totalClicks: number;
  blockedClicks: number;
  allowedClicks: number;

  // Trust system (0-100)
  trustLevel: number;

  // Shield status
  isShieldActive: boolean;
  isInDangerousPeriod: boolean;

  // User interaction
  userHasInteractedWithVideo: boolean;
}

export class ClickShield {
  private config: ClickShieldConfig;
  private state: ClickShieldState;

  // Timing constants - MORE aggressive for mobile
  private readonly TIMINGS = {
    desktop: {
      pageLoadGracePeriod: 5000,      // 5 seconds after page loads
      iframeLoadGracePeriod: 5000,    // 5 seconds after iframe loads
      minTimeBetweenClicks: 450,      // Prevent double-click hijacking
      afterPopupReblock: 45000,       // 45 seconds after popup detected
      firstClicksToBlock: 6,          // Block first N clicks
      trustIncrement: 6,              // Increase trust per clean click
      trustDecrement: 75,             // Decrease trust on popup
      maxTrustForBlocking: 60,        // Below this = aggressive blocking
    },
    mobile: {
      pageLoadGracePeriod: 7000,      // 7 seconds (mobile ads more aggressive)
      iframeLoadGracePeriod: 7000,    // 7 seconds
      minTimeBetweenClicks: 600,      // Slower touch interactions
      afterPopupReblock: 60000,       // 60 seconds (mobile popups persist longer)
      firstClicksToBlock: 8,          // Block first 8 touches (mobile ads worse)
      trustIncrement: 4,              // Slower trust building
      trustDecrement: 85,             // Larger trust loss
      maxTrustForBlocking: 70,        // More cautious on mobile
    },
  };

  constructor(config: ClickShieldConfig) {
    this.config = config;

    const now = Date.now();
    this.state = {
      pageLoadTime: now,
      iframeLoadTime: now,
      lastClickTime: 0,
      lastPopupDetectedTime: 0,
      paranoiaUntil: 0,
      totalClicks: 0,
      blockedClicks: 0,
      allowedClicks: 0,
      trustLevel: 0, // Start with ZERO trust
      isShieldActive: true,
      isInDangerousPeriod: true,
      userHasInteractedWithVideo: false,
    };

    console.log('[ClickShield] 🛡️ Initialized', {
      mode: config.isMobile ? 'MOBILE' : 'DESKTOP',
      trustLevel: this.state.trustLevel,
    });
  }

  /**
   * Call this when iframe loads/changes
   */
  public onIframeLoad(): void {
    this.state.iframeLoadTime = Date.now();
    this.state.totalClicks = 0; // Reset click count for new video
    this.state.userHasInteractedWithVideo = false;

    console.log('[ClickShield] 📺 Iframe loaded - resetting protection');
  }

  /**
   * Call this when popup is detected by global ad blocker
   */
  public onPopupDetected(): void {
    const now = Date.now();
    this.state.lastPopupDetectedTime = now;

    // Keep shield in paranoia mode for extended period
    const timings = this.config.isMobile ? this.TIMINGS.mobile : this.TIMINGS.desktop;
    this.state.paranoiaUntil = now + timings.afterPopupReblock;

    // RESET TRUST - popup means we're under attack
    const oldTrust = this.state.trustLevel;
    this.state.trustLevel = 0;

    // Re-enable shield
    this.state.isShieldActive = true;

    console.log('[ClickShield] 🚨 POPUP DETECTED - Trust reset:', {
      oldTrust,
      newTrust: 0,
      shieldActive: true,
    });

    if (this.config.onPopupDetected) {
      this.config.onPopupDetected();
    }

    if (this.config.onTrustLevelChanged) {
      this.config.onTrustLevelChanged(0);
    }
  }

  /**
   * Force paranoia mode externally (e.g., adBlocker detects a bad URL)
   */
  public enterParanoia(durationMs?: number): void {
    const now = Date.now();
    const timings = this.config.isMobile ? this.TIMINGS.mobile : this.TIMINGS.desktop;

    const effectiveDuration = durationMs ?? timings.afterPopupReblock * 1.5;

    this.state.lastPopupDetectedTime = now;
    this.state.paranoiaUntil = now + effectiveDuration;
    const oldTrust = this.state.trustLevel;
    this.state.trustLevel = 0;
    this.state.isShieldActive = true;

    console.log('[ClickShield] 🚧 Paranoia mode engaged', {
      oldTrust,
      newTrust: 0,
      until: this.state.paranoiaUntil,
      durationMs: effectiveDuration,
    });

    if (this.config.onTrustLevelChanged) {
      this.config.onTrustLevelChanged(this.state.trustLevel);
    }
  }

  /**
   * Main decision function: Should we block this click?
   */
  public shouldBlockClick(): boolean {
    if (!this.config.enabled) {
      return false; // Shield disabled
    }

    const now = Date.now();
    const timings = this.config.isMobile ? this.TIMINGS.mobile : this.TIMINGS.desktop;

    // RULE 1: Page just loaded (DANGEROUS)
    if (now - this.state.pageLoadTime < timings.pageLoadGracePeriod) {
      console.log('[ClickShield] ⛔ BLOCK: Page load grace period');
      return true;
    }

    // RULE 2: Iframe just loaded (DANGEROUS)
    if (now - this.state.iframeLoadTime < timings.iframeLoadGracePeriod) {
      console.log('[ClickShield] ⛔ BLOCK: Iframe load grace period');
      return true;
    }

    // RULE 3: First N clicks are ALWAYS blocked (MOST DANGEROUS)
    if (this.state.totalClicks < timings.firstClicksToBlock) {
      console.log(`[ClickShield] ⛔ BLOCK: First ${timings.firstClicksToBlock} clicks (current: ${this.state.totalClicks})`);
      return true;
    }

    // RULE 4: Clicks too close together (double-click hijacking)
    if (this.state.lastClickTime > 0 && now - this.state.lastClickTime < timings.minTimeBetweenClicks) {
      console.log('[ClickShield] ⛔ BLOCK: Clicks too close together');
      return true;
    }

    // RULE 5: Recently detected a popup (RE-ENABLE PROTECTION)
    if (this.state.lastPopupDetectedTime > 0 && now - this.state.lastPopupDetectedTime < timings.afterPopupReblock) {
      console.log('[ClickShield] ⛔ BLOCK: Recent popup detected, re-blocking');
      return true;
    }

    // RULE 6: Trust-based adaptive blocking
    if (this.state.trustLevel < timings.maxTrustForBlocking) {
      // Low trust = probabilistic blocking
      const blockProbability = 1 - (this.state.trustLevel / timings.maxTrustForBlocking);

      // For very low trust (< 15), always block
      if (this.state.trustLevel < 15) {
        console.log('[ClickShield] ⛔ BLOCK: Very low trust level', this.state.trustLevel);
        return true;
      }

      // For low-medium trust, probabilistic blocking
      if (Math.random() < blockProbability * 0.5) {
        console.log('[ClickShield] ⛔ BLOCK: Trust-based probabilistic block', {
          trustLevel: this.state.trustLevel,
          probability: blockProbability,
        });
        return true;
      }
    }

    // ALL CHECKS PASSED - ALLOW CLICK
    console.log('[ClickShield] ✅ ALLOW: All checks passed', {
      trustLevel: this.state.trustLevel,
      totalClicks: this.state.totalClicks,
    });
    return false;
  }

  /**
   * Handle click event
   */
  public handleClick(): { shouldBlock: boolean; shouldAllowTemporarily: boolean } {
    const now = Date.now();
    this.state.totalClicks++;
    this.state.lastClickTime = now;

    const shouldBlock = this.shouldBlockClick();

    if (shouldBlock) {
      this.state.blockedClicks++;
      this.state.isShieldActive = true;

      return {
        shouldBlock: true,
        shouldAllowTemporarily: false,
      };
    } else {
      // ALLOW - increase trust
      this.state.allowedClicks++;
      this.state.userHasInteractedWithVideo = true;

      const oldTrust = this.state.trustLevel;
      const timings = this.config.isMobile ? this.TIMINGS.mobile : this.TIMINGS.desktop;
      this.state.trustLevel = Math.min(100, this.state.trustLevel + timings.trustIncrement);

      if (oldTrust !== this.state.trustLevel && this.config.onTrustLevelChanged) {
        this.config.onTrustLevelChanged(this.state.trustLevel);
      }

      // Temporarily allow interaction
      this.state.isShieldActive = false;

      console.log('[ClickShield] ✅ Click allowed, trust increased:', {
        oldTrust,
        newTrust: this.state.trustLevel,
      });

      return {
        shouldBlock: false,
        shouldAllowTemporarily: true,
      };
    }
  }

  /**
   * Get current state (for debugging/UI)
   */
  public getState(): Readonly<ClickShieldState> {
    return { ...this.state };
  }

  /**
   * Get shield active status
   */
  public isActive(): boolean {
    return this.state.isShieldActive;
  }

  /**
   * Manual shield control (for special cases)
   */
  public enableShield(): void {
    this.state.isShieldActive = true;
    console.log('[ClickShield] 🛡️ Shield manually enabled');
  }

  public disableShield(): void {
    this.state.isShieldActive = false;
    console.log('[ClickShield] 🔓 Shield manually disabled');
  }

  /**
   * Re-enable shield after allowing temporary interaction
   */
  public reenableShieldAfterDelay(delayMs: number = 500): void {
    setTimeout(() => {
      if (this.state.trustLevel < 50) {
        // Only re-enable if trust is still low
        this.state.isShieldActive = true;
        console.log('[ClickShield] 🛡️ Shield re-enabled after delay');
      }
    }, delayMs);
  }

  /**
   * Get statistics (for debugging)
   */
  public getStats(): {
    totalClicks: number;
    blockedClicks: number;
    allowedClicks: number;
    trustLevel: number;
    blockRate: number;
  } {
    const blockRate = this.state.totalClicks > 0
      ? (this.state.blockedClicks / this.state.totalClicks) * 100
      : 0;

    return {
      totalClicks: this.state.totalClicks,
      blockedClicks: this.state.blockedClicks,
      allowedClicks: this.state.allowedClicks,
      trustLevel: this.state.trustLevel,
      blockRate: Math.round(blockRate),
    };
  }
}

/**
 * Helper function to create and configure click shield
 */
export function createClickShield(isMobile: boolean, onPopupDetected?: () => void): ClickShield {
  return new ClickShield({
    enabled: true,
    isMobile,
    onPopupDetected,
    onTrustLevelChanged: (level) => {
      console.log('[ClickShield] Trust level changed:', level);
    },
  });
}

// Safe device & orientation detection for TTF RUN
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia('(pointer: coarse)').matches &&
      Math.min(screen.width, screen.height) < 900
    );
  } catch {
    return false;
  }
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      (navigator.maxTouchPoints !== undefined && navigator.maxTouchPoints > 0) ||
      'ontouchstart' in window
    );
  } catch {
    return false;
  }
}

export function isPortraitMobile(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Desktop or laptop must NEVER see the rotate overlay and must NEVER be paused by it
    const isMobile = isMobileDevice();
    if (!isMobile) return false;
    return window.innerHeight > window.innerWidth;
  } catch {
    return false;
  }
}

export function enterMobileFullscreen(): void {
  // Mobile touch phones only - do not run on desktop
  if (!isMobileDevice()) return;

  // 1. requestFullscreen (document.documentElement.requestFullscreen with webkit fallback)
  try {
    const docEl = document.documentElement as any;
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (typeof docEl.requestFullscreen === 'function') {
        docEl.requestFullscreen().catch(() => {});
      } else if (typeof docEl.webkitRequestFullscreen === 'function') {
        docEl.webkitRequestFullscreen().catch(() => {});
      }
    }
  } catch {}

  // 2. screen.orientation.lock('landscape')
  try {
    const screenObj = typeof window !== 'undefined' ? window.screen : undefined;
    const orientation = screenObj?.orientation as any;
    if (orientation && typeof orientation.lock === 'function') {
      orientation.lock('landscape').catch(() => {});
    }
  } catch {}
}

export const requestMobileFullscreenAndOrientation = enterMobileFullscreen;

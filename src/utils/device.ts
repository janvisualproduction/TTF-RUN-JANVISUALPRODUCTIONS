// Safe device & orientation detection for TTF RUN
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
    const isTouch = isTouchDevice();
    if (!isTouch) return false;
    return window.innerHeight > window.innerWidth;
  } catch {
    return false;
  }
}

export async function requestMobileFullscreenAndOrientation(): Promise<void> {
  // Only run when touch is true
  if (!isTouchDevice()) return;

  // 1. Safe requestFullscreen
  try {
    const docEl = document.documentElement as any;
    if (!document.fullscreenElement) {
      if (typeof docEl.requestFullscreen === 'function') {
        await docEl.requestFullscreen().catch(() => {});
      } else if (typeof docEl.webkitRequestFullscreen === 'function') {
        await docEl.webkitRequestFullscreen().catch(() => {});
      }
    }
  } catch {
    // Silently continue - game must run even if fullscreen fails
  }

  // 2. Safe screen.orientation.lock
  try {
    const screenObj = typeof window !== 'undefined' ? window.screen : undefined;
    const orientation = screenObj?.orientation as any;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape').catch(() => {});
    }
  } catch {
    // Silently continue - devices like iPhone don't support orientation.lock
  }
}

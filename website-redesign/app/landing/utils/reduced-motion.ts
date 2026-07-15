const QUERY = "(prefers-reduced-motion: reduce)";

export const reducedMotion = { current: false };

export function initReducedMotion(signal: AbortSignal, onChange: () => void) {
  const media = window.matchMedia(QUERY);

  function sync() {
    const next = media.matches;
    if (reducedMotion.current === next) return;
    reducedMotion.current = next;
    onChange();
  }

  reducedMotion.current = media.matches;

  media.addEventListener("change", sync, { signal });
}

export function motionScrollBehavior(): ScrollBehavior {
  return reducedMotion.current ? "auto" : "smooth";
}

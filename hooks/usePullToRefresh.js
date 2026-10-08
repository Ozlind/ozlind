import { useEffect, useRef, useState } from "react";

export function usePullToRefresh({ enabled = true, threshold = 76, onRefresh }) {
  const [distance, setDistance] = useState(0);
  const stateRef = useRef({ active: false, startY: 0, distance: 0, target: null });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const state = stateRef.current;
    const reset = () => { state.active = false; state.startY = 0; state.distance = 0; state.target = null; setDistance(0); };
    const onTouchStart = (event) => {
      if (window.innerWidth > 768 || event.touches.length !== 1) return;
      const target = event.target;
      if (target?.closest?.('textarea, input, button, [role="dialog"], .account-overlay, .dialog-backdrop, .mobile-sidebar-backdrop')) return;
      const workspace = target?.closest?.(".workspace");
      const scrollContainer = target?.closest?.(".messages-list");
      if (!workspace || (scrollContainer && scrollContainer.scrollTop > 0)) return;
      state.active = true; state.startY = event.touches[0].clientY; state.distance = 0; state.target = scrollContainer || workspace;
    };
    const onTouchMove = (event) => {
      if (!state.active || event.touches.length !== 1) return;
      const delta = event.touches[0].clientY - state.startY;
      if (delta <= 0 || (state.target && "scrollTop" in state.target && state.target.scrollTop > 0)) { reset(); return; }
      const damped = Math.min(112, delta * 0.52); state.distance = damped; setDistance(damped);
      if (damped > 4) event.preventDefault();
    };
    const onTouchEnd = () => { if (!state.active) return; const refresh = state.distance >= threshold; reset(); if (refresh) onRefresh?.(); };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
    return () => { document.removeEventListener("touchstart", onTouchStart); document.removeEventListener("touchmove", onTouchMove); document.removeEventListener("touchend", onTouchEnd); document.removeEventListener("touchcancel", reset); };
  }, [enabled, onRefresh, threshold]);
  return distance;
}

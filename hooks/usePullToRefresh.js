"use client";

import { useEffect, useRef, useState } from "react";

export function usePullToRefresh({
  enabled = true,
  threshold = 76,
  onRefresh,
}) {
  const [distance, setDistance] = useState(0);
  const onRefreshRef = useRef(onRefresh);
  const stateRef = useRef({
    active: false,
    startY: 0,
    distance: 0,
    target: null,
  });

  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const state = stateRef.current;
    const reset = () => {
      state.active = false;
      state.startY = 0;
      state.distance = 0;
      state.target = null;
      setDistance(0);
    };

    const start = (event) => {
      if (window.innerWidth > 768 || event.touches.length !== 1) return;

      const target = event.target;
      if (
        target?.closest?.(
          'textarea,input,button,[role="dialog"],.oz-v3-sidebar',
        )
      ) {
        return;
      }

      const scrollable = target?.closest?.(".oz-v3-scroll");
      if (!scrollable || scrollable.scrollTop > 0) return;

      state.active = true;
      state.startY = event.touches[0].clientY;
      state.distance = 0;
      state.target = scrollable;
    };

    const move = (event) => {
      if (!state.active || event.touches.length !== 1) return;

      const delta = event.touches[0].clientY - state.startY;
      if (delta <= 0 || state.target?.scrollTop > 0) {
        reset();
        return;
      }

      const next = Math.min(112, delta * 0.52);
      state.distance = next;
      setDistance(next);

      if (next > 4) event.preventDefault();
    };

    const end = () => {
      if (!state.active) return;
      const shouldRefresh = state.distance >= threshold;
      reset();
      if (shouldRefresh) onRefreshRef.current?.();
    };

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });

    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", reset);
    };
  }, [enabled, threshold]);

  return distance;
}

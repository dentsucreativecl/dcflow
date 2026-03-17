"use client";

import { useState, useEffect } from "react";

/**
 * Finds a DOM element by data-tour-id and tracks its position.
 * Uses MutationObserver to wait for elements that may not be in DOM yet (after navigation).
 */
export function useTourTarget(targetId: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetId) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let observer: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    function findAndTrack() {
      const el = document.querySelector(`[data-tour-id="${targetId}"]`);
      if (!el || cancelled) return false;

      // Scroll element into view
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      // Wait for scroll to settle, then capture rect
      setTimeout(() => {
        if (cancelled) return;
        updateRect(el);
        startTracking(el);
      }, 350);

      return true;
    }

    function updateRect(el: Element) {
      if (cancelled) return;
      const r = el.getBoundingClientRect();
      setRect(new DOMRect(r.x, r.y, r.width, r.height));
    }

    function startTracking(el: Element) {
      // Track resize
      resizeObserver = new ResizeObserver(() => {
        if (!cancelled) updateRect(el);
      });
      resizeObserver.observe(el);

      // Track scroll
      const onScroll = () => {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          if (!cancelled) updateRect(el);
        }, 50);
      };
      window.addEventListener("scroll", onScroll, true);

      // Cleanup stored for later
      const cleanup = () => {
        resizeObserver?.disconnect();
        window.removeEventListener("scroll", onScroll, true);
        if (scrollTimer) clearTimeout(scrollTimer);
      };
      // Store cleanup on the observer for the main cleanup
      (resizeObserver as any).__cleanup = cleanup;
    }

    // Try immediately
    if (!findAndTrack()) {
      // Element not found — watch for it with MutationObserver (max 2s)
      const timeout = setTimeout(() => {
        observer?.disconnect();
        if (!cancelled) setRect(null); // give up
      }, 2000);

      observer = new MutationObserver(() => {
        if (findAndTrack()) {
          observer?.disconnect();
          clearTimeout(timeout);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (resizeObserver) {
        (resizeObserver as any).__cleanup?.();
        resizeObserver.disconnect();
      }
    };
  }, [targetId]);

  return rect;
}

"use client";

/**
 * Screen Wake Lock Hook
 * 
 * Prevents screen from sleeping during capture or playback.
 * Re-acquires on visibilitychange (user switches back to tab).
 */

import { useRef, useCallback, useEffect, useState } from "react";

export interface WakeLockState {
  locked: boolean;
  supported: boolean;
  error: string | null;
}

export function useWakeLock() {
  const [state, setState] = useState<WakeLockState>({
    locked: false,
    supported: typeof window !== "undefined" && "wakeLock" in navigator,
    error: null,
  });
  
  const sentinelRef = useRef<any>(null);
  const keepAliveRef = useRef(false);

  const acquire = useCallback(async () => {
    if (!state.supported) {
      setState(s => ({ ...s, error: "Screen Wake Lock not supported in this browser" }));
      return;
    }

    keepAliveRef.current = true;

    try {
      const sentinel = await (navigator as any).wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setState(s => ({ ...s, locked: true, error: null }));

      sentinel.addEventListener("release", () => {
        setState(s => ({ ...s, locked: false }));
      });
    } catch (err: any) {
      setState(s => ({
        ...s,
        locked: false,
        error: `Wake lock failed: ${err.message}. Keep this screen on manually.`,
      }));
    }
  }, [state.supported]);

  const release = useCallback(async () => {
    keepAliveRef.current = false;
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch { /* already released */ }
      sentinelRef.current = null;
    }
    setState(s => ({ ...s, locked: false }));
  }, []);

  // Re-acquire on visibility change
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState === "visible" && keepAliveRef.current) {
        // Re-acquire if it was released during background
        if (!sentinelRef.current || sentinelRef.current.released) {
          try {
            const sentinel = await (navigator as any).wakeLock.request("screen");
            sentinelRef.current = sentinel;
            setState(s => ({ ...s, locked: true, error: null }));
            sentinel.addEventListener("release", () => {
              setState(s => ({ ...s, locked: false }));
            });
          } catch (err: any) {
            setState(s => ({ ...s, error: `Wake lock lost: ${err.message}` }));
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Release on unmount
  useEffect(() => {
    return () => {
      keepAliveRef.current = false;
      sentinelRef.current?.release?.().catch(() => {});
    };
  }, []);

  return { ...state, acquire, release };
}

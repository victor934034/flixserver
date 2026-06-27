import { useEffect, useRef } from 'react';

export const KEY = {
  LEFT:      37,
  RIGHT:     39,
  UP:        38,
  DOWN:      40,
  ENTER:     13,
  BACK:      461,
  BACKSPACE: 8,
  RED:       403,
  GREEN:     404,
  YELLOW:    405,
  BLUE:      406,
  PLAY:      415,
  PAUSE:     19,
  STOP:      413,
  FAST_FWD:  417,
  REWIND:    412,
};

// Keeps a stable event listener but always calls the latest handler ref.
// This avoids tearing down/re-adding the listener on every render.
export function useKeyDown(handler, deps = []) {
  const handlerRef = useRef(handler);
  // Keep ref in sync with latest handler without triggering re-subscription
  useEffect(() => { handlerRef.current = handler; });

  useEffect(() => {
    const fn = (e) => handlerRef.current(e);
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []); // only once
}

export default useKeyDown;

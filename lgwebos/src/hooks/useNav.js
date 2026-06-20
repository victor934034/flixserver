import { useEffect } from 'react';

// LG WebOS / TV key codes
export const KEY = {
  LEFT:      37,
  RIGHT:     39,
  UP:        38,
  DOWN:      40,
  ENTER:     13,
  BACK:      461,   // LG WebOS back button
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

/**
 * useKeyDown — attach a keydown listener to document.
 * handler receives the native KeyboardEvent.
 * Returns cleanup automatically when the component unmounts.
 */
export function useKeyDown(handler, deps = []) {
  useEffect(() => {
    const onKey = (e) => handler(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export default useKeyDown;

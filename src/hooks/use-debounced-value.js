import { useEffect, useState } from 'react';

/**
 * A value that follows the input with a delay.
 *
 * Used by the search field so typing "1234" searches once, on the pause
 * after the last digit, instead of four times. The returned value is the
 * last one written before the delay elapsed; submitting early (the keyboard
 * action) can flush it by passing the value through state itself.
 *
 * @param {*} value - the value to settle on
 * @param {number} [delayMs] - quiet period before the value is taken
 * @returns {*} the debounced value
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}

import { useEffect, useState } from "react";

export function useClock(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timeoutId;

    const tick = () => {
      setNow(Date.now());
      timeoutId = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };

    timeoutId = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    return () => window.clearTimeout(timeoutId);
  }, [intervalMs]);

  return now;
}

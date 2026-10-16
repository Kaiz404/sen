import { useEffect, useState } from 'react';

function secondsUntil(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function useSecondsLeft(deadline: number | null): number {
  const [left, setLeft] = useState(() => secondsUntil(deadline, Date.now()));

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = Date.now();
      setLeft(secondsUntil(deadline, now));
      if (deadline !== null && deadline > now)
        id = setTimeout(tick, (deadline - now) % 1000 || 1000);
    };
    tick();
    return () => clearTimeout(id);
  }, [deadline]);

  return left;
}

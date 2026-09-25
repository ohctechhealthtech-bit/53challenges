import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

export default function Typewriter({ text, speed = 50, delay = 0, className, cursor = true }) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(reducedMotion ? text : '');
  const [done, setDone] = useState(reducedMotion);
  const timers = useRef([]);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed('');
    setDone(false);

    const startTimer = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      timers.current.push(interval);
    }, delay);

    timers.current.push(startTimer);
    return () => timers.current.forEach(clearInterval);
  }, [text, speed, delay, reducedMotion]);

  return (
    <span className={className}>
      {displayed}
      {cursor && !reducedMotion && (
        <span
          className="ml-0.5 inline-block w-[3px] bg-primary align-middle"
          style={{ height: '0.85em', animation: 'blinkCursor 0.8s steps(2) infinite' }}
        />
      )}
    </span>
  );
}
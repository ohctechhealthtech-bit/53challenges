import { useEffect, useRef, useState } from 'react';

// Defers rendering (and therefore any data fetching inside its children) until
// the section scrolls near the viewport. Use to lazy-load everything below the
// hero so the first paint stays light.
export default function LazySection({ children, as: Tag = 'div', className = '', rootMargin = '350px', minHeight = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return (
    <Tag ref={ref} className={className} style={minHeight && !visible ? { minHeight } : undefined}>
      {visible ? children : null}
    </Tag>
  );
}
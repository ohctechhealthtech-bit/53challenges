import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';

/** Square class thumbnail with a graceful icon fallback when no image loads. */
export default function ClassThumb({ src, alt, className = 'h-16 w-16' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        className={`grid shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-500 ${className}`}
        aria-label={alt || 'Class'}
      >
        <GraduationCap className="h-6 w-6" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-xl object-cover ${className}`}
    />
  );
}
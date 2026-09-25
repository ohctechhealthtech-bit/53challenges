import { useEffect, useState } from 'react';
import { listHostServices } from '@/lib/hostServices';

export default function useHostServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listHostServices()
      .then((rows) => { if (active) setServices(rows); })
      .catch((e) => { if (active) setError(e?.message || 'Could not load the optional services'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { services, loading, error };
}
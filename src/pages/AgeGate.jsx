import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/lib/AuthContext';
import { canSelfRegister, markAgeOk } from '@/lib/ageGate';
import { getSessionToken } from '@/lib/customSession';

export default function AgeGate() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dob, setDob] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('53_pending_dob');
      if (pending) setDob(pending);
    } catch {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!confirmed) {
      setError('Confirm that this is your date of birth.');
      return;
    }
    const gate = canSelfRegister(dob);
    if (!gate.ok) {
      setError(gate.reason);
      if (gate.age != null && gate.age < 16) {
        try { await logout(false); } catch {}
      }
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('recordAgeGate', {
        date_of_birth: dob,
        session_token: getSessionToken(),
      });
      const data = res.data || res;
      if (data?.blocked || data?.error) {
        setError(data.error || gate.reason);
        if (data?.blocked) {
          try { await logout(false); } catch {}
        }
        return;
      }
      markAgeOk(user?.email);
      navigate('/my-dashboard', { replace: true });
    } catch (err) {
      const data = err?.response?.data ?? err?.data;
      setError(data?.error || err.message || 'Could not save date of birth');
      if (data?.blocked) {
        try { await logout(false); } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={CalendarDays}
      title="Confirm your age"
      subtitle="We need your date of birth before you can use 53 Challenges. Under 16s need a parent or guardian."
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input
            id="dob"
            type="date"
            autoComplete="bday"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="h-12"
            required
            max={new Date().toISOString().slice(0, 10)}
            min="1905-01-01"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm this is my date of birth.
        </label>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Parent or guardian? <Link to="/guardian" className="text-primary font-medium hover:underline">Open the guardian portal</Link>
      </p>
    </AuthLayout>
  );
}

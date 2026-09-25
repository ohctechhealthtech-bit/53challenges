import { useState } from 'react';
import { LayoutDashboard, Route, CalendarCheck, BarChart3, GraduationCap } from 'lucide-react';
import SubTabs from '@/components/dashboard/SubTabs';
import ClassesOverview from '@/components/dashboard/classes/ClassesOverview';
import LearningPath from '@/components/dashboard/classes/LearningPath';
import BookingsList from '@/components/dashboard/classes/BookingsList';
import ClassProgress from '@/components/dashboard/classes/ClassProgress';
import ClassesPanel from '@/components/dashboard/ClassesPanel';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'path', label: 'Learning Path', icon: Route },
  { key: 'bookings', label: 'Bookings', icon: CalendarCheck },
  { key: 'progress', label: 'Progress', icon: BarChart3 },
  { key: 'browse', label: 'Browse Classes', icon: GraduationCap },
];

/** Classes tab — everything about the student's learning, in sub-tabs. */
export default function ClassesTab({ enrolled, running, entries }) {
  const [sub, setSub] = useState('overview');

  const nextBooking = [...enrolled]
    .filter((c) => c.class_date)
    .sort((a, b) => new Date(a.class_date) - new Date(b.class_date))
    .find((c) => new Date(`${c.class_date}T${c.class_time || '00:00'}`) >= new Date()) || null;

  return (
    <div className="space-y-6">
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'overview' && <ClassesOverview enrolled={enrolled} running={running} nextBooking={nextBooking} />}
      {sub === 'path' && <LearningPath enrolled={enrolled} running={running} entries={entries} />}
      {sub === 'bookings' && <BookingsList enrolled={enrolled} />}
      {sub === 'progress' && <ClassProgress enrolled={enrolled} />}
      {sub === 'browse' && <ClassesPanel enrolled={enrolled} running={running} loading={false} />}
    </div>
  );
}
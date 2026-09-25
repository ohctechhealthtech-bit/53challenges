/**
 * Answer tiles for the idea wizard — the same tile pattern as the host
 * application wizard, so both journeys look and behave the same.
 */
import QuestionTiles from '@/components/host/QuestionTiles';

export default function IdeaTilePicker({ options, value, onChange, multi = false }) {
  return <QuestionTiles options={options} value={value} onChange={onChange} multi={multi} />;
}
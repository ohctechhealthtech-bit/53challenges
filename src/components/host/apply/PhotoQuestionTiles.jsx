/**
 * Photo-led answer tiles for the discovery sub-steps. Options without a mapped
 * photo fall back to the standard icon tiles so nothing ever renders blank.
 */
import QuestionTiles from '@/components/host/QuestionTiles';
import PhotoTile from '@/components/host/apply/PhotoTile';
import RecommendedBadge from '@/components/host/RecommendedBadge';

export default function PhotoQuestionTiles({ options, images, value, onChange, recommended }) {
  const allHavePhotos = options.every((o) => images[o.value]);
  if (!allHavePhotos) {
    return <QuestionTiles options={options} value={value} onChange={onChange} recommended={recommended} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup">
      {options.map((o) => (
        <PhotoTile
          key={o.value}
          image={images[o.value]}
          label={o.label}
          description={o.description}
          active={value === o.value}
          onClick={() => onChange(o.value)}
          badge={recommended === o.value ? <RecommendedBadge /> : null}
        />
      ))}
    </div>
  );
}
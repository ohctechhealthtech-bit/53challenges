/**
 * Photo answer tiles for the idea wizard — same look as the host application
 * discovery steps, but works for single or multi selection.
 */
import PhotoTile from '@/components/host/apply/PhotoTile';
import IdeaTilePicker from '@/components/host/idea/IdeaTilePicker';

export default function IdeaPhotoPicker({ options, images, value, onChange, multi = false }) {
  // Any option without a photo falls back to the icon tiles so nothing renders blank.
  if (!options.every((o) => images[o.value])) {
    return <IdeaTilePicker options={options} value={value} onChange={onChange} multi={multi} />;
  }

  const list = multi ? value || [] : [];
  const active = (v) => (multi ? list.includes(v) : value === v);
  const toggle = (v) =>
    multi ? onChange(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]) : onChange(v);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role={multi ? 'group' : 'radiogroup'}>
      {options.map((o) => (
        <PhotoTile
          key={o.value}
          image={images[o.value]}
          label={o.label}
          description={o.description}
          aspect="aspect-[4/3]"
          multi={multi}
          active={active(o.value)}
          onClick={() => toggle(o.value)}
        />
      ))}
    </div>
  );
}
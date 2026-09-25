/**
 * Banner image upload for a host's own challenge — replaces the category
 * question on the shortlist step (category is already chosen earlier).
 */
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';

export default function ChallengeBannerUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } catch {
      setError("That image didn't upload — please try again.");
    }
    setUploading(false);
  };

  return (
    <div>
      <label htmlFor="challenge-banner" className="mb-1 block text-sm font-semibold">
        Challenge banner image <span className="text-muted-foreground">(optional)</span>
      </label>
      <p className="mb-2 text-sm text-muted-foreground">
        A wide photo that shows what your challenge is about — it appears at the top of your challenge page.
      </p>

      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-border">
          <Image src={value} alt="Challenge banner" className="h-48 w-full" fittingType="fill" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted-foreground transition hover:border-primary/60 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <ImagePlus className="h-5 w-5" />}
          <span className="font-semibold">{uploading ? 'Uploading…' : 'Upload a banner image'}</span>
          <span className="text-xs">JPG or PNG, landscape works best</span>
        </button>
      )}

      <input
        ref={inputRef}
        id="challenge-banner"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
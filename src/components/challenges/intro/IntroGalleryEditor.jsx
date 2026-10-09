import { useRef, useState } from 'react';
import { Upload, Loader2, X, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Edits intro.gallery: an array of image URLs, uploaded or pasted.
export default function IntroGalleryEditor({ value = [], onChange, disabled }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [link, setLink] = useState('');

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      onChange([...value, ...urls]);
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {value.map((src, i) => (
            <div key={src + '-' + i} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
              <img src={src} alt="" className="h-full w-full object-cover" />
              {!disabled && (
                <button type="button" aria-label="Remove image" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Upload images'}
        </Button>
        <input className="c53-input min-w-[180px] flex-1" placeholder="…or paste an image URL" disabled={disabled} value={link} onChange={(e) => setLink(e.target.value)} />
        <Button type="button" size="sm" variant="ghost" className="gap-1" disabled={disabled || !link.trim()} onClick={() => { onChange([...value, link.trim()]); setLink(''); }}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
}

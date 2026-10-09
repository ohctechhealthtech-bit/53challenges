import { useRef, useState } from 'react';
import { Upload, Loader2, ImageIcon, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// A preview, an upload button, and the URL itself — editable, so an image
// hosted elsewhere can still be pasted in. Uploads go through the same
// UploadFile integration entries use.
export default function CoverImagePicker({ value, onChange, disabled }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {value
            ? <img src={value} alt="Cover preview" className="h-full w-full object-cover" />
            : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading…' : value ? 'Change image' : 'Upload image'}
        </Button>
        {value && !disabled && (
          <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => onChange('')}>
            <X className="h-4 w-4" /> Remove
          </Button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      <input
        className="c53-input"
        placeholder="…or paste an image URL"
        disabled={disabled}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

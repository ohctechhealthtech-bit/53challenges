// The kinds of work a challenge can accept. Leave the list empty to accept all.
export const ENTRY_TYPE_OPTIONS = [
  { value: 'image', label: 'Image', desc: 'Photos, artwork, scans (JPG, PNG)' },
  { value: 'video', label: 'Video', desc: 'Video files or a video link' },
  { value: 'audio', label: 'Audio', desc: 'Music, voice or sound recordings' },
  { value: 'document', label: 'Document', desc: 'PDF, Word or slide files' },
  { value: 'text', label: 'Written text', desc: 'Typed directly into the entry form' },
  { value: 'link', label: 'External link', desc: 'A link to work hosted elsewhere' },
];
import TemplateLibraryPanel from '@/components/templates/TemplateLibraryPanel';

export default function TemplateLibraryAdmin() {
  return (
    <div className="container-tight py-8">
      <h1 className="font-heading text-3xl font-extrabold">Template Library</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Build, version and publish the master challenge templates hosts choose from.
      </p>
      <div className="mt-6">
        <TemplateLibraryPanel />
      </div>
    </div>
  );
}
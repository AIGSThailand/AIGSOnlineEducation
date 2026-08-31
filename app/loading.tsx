export default function Loading() {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
      <p className="mt-4 text-sm text-slate-500">Loading resources...</p>
    </div>
  );
}

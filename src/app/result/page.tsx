export default function ResultPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-[600px] space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight">
            ✓ Your video is ready
          </h1>
        </div>

        <div className="aspect-video w-full rounded-lg bg-neutral-100 flex items-center justify-center">
          <p className="text-sm text-neutral-400">Video player</p>
        </div>

        <div className="flex gap-3">
          <button className="flex-1 rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
            Copy link
          </button>
          <button className="flex-1 rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
            Download
          </button>
        </div>

        <a
          href="/"
          className="block text-center text-sm text-neutral-500 hover:text-neutral-900"
        >
          Generate another →
        </a>
      </div>
    </main>
  );
}

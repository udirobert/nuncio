export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-[600px] space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight">nuncio</h1>
          <p className="text-sm text-neutral-500">
            Drop a name or any social URL. Get a personalised video in 60
            seconds.
          </p>
        </div>

        <form className="space-y-4">
          <div className="space-y-3">
            <label htmlFor="linkedin" className="block text-sm font-medium">
              LinkedIn URL
            </label>
            <input
              id="linkedin"
              name="linkedin"
              type="url"
              placeholder="https://linkedin.com/in/username"
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />

            <label htmlFor="twitter" className="block text-sm font-medium">
              Twitter / X
            </label>
            <input
              id="twitter"
              name="twitter"
              type="url"
              placeholder="https://x.com/username"
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />

            <label htmlFor="other" className="block text-sm font-medium">
              Other URL
            </label>
            <input
              id="other"
              name="other"
              type="url"
              placeholder="https://..."
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <p className="text-xs text-neutral-400">
            At least one URL required.
          </p>

          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate video →
          </button>
        </form>
      </div>
    </main>
  );
}

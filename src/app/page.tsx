export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="max-w-2xl px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.02] text-xs text-white/60 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Foundation ready
        </div>

        <h1 className="text-5xl font-serif italic mb-4 tracking-tight">
          Vocito Studio
        </h1>

        <p className="text-lg text-white/60 mb-8">
          AI-powered video generation. Prompt, review, iterate.
        </p>

        <div className="text-xs text-white/30 font-mono">
          Brief A1 complete · Design system coming in A2
        </div>
      </div>
    </main>
  );
}

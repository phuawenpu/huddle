import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 safe-top safe-bottom safe-left safe-right">
      <div className="max-w-lg w-full space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-hud-text">
            Critique HUD
          </h1>
          <p className="text-hud-muted text-lg">
            A shared cognitive mirror for Design Thinking critiques
          </p>
        </header>

        <nav className="space-y-4">
          <Link
            href="/sessions/new"
            className="block w-full py-4 px-6 bg-hud-accent text-white text-center rounded-xl font-semibold text-lg
              hover:bg-hud-accent-dim active:scale-[0.98] transition-all touch-manipulation"
            style={{ minHeight: 56 }}
          >
            Start Live Critique
          </Link>
          <Link
            href="/scenarios"
            className="block w-full py-4 px-6 bg-hud-surface border border-hud-border text-hud-text text-center rounded-xl font-semibold text-lg
              hover:border-hud-accent active:scale-[0.98] transition-all touch-manipulation"
            style={{ minHeight: 56 }}
          >
            Simulated Sessions
          </Link>
          <Link
            href="/scenarios/new"
            className="block w-full py-4 px-6 bg-hud-surface border border-hud-border text-hud-text text-center rounded-xl font-semibold text-lg
              hover:border-hud-accent active:scale-[0.98] transition-all touch-manipulation"
            style={{ minHeight: 56 }}
          >
            Generate Scenario
          </Link>
        </nav>

        <footer className="text-center text-hud-muted text-sm pt-8">
          <p>No biometric identification · No personality scoring</p>
          <p>Every AI output is correctable</p>
        </footer>
      </div>
    </main>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#090909] text-[#F4F4F5] flex flex-col items-center justify-center p-4">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
        <span className="text-2xl font-mono text-cyan-400">404</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Page Not Found</h1>
      <p className="text-sm text-zinc-400 max-w-md text-center mb-6">
        The requested resource or server could not be located on this Obsidian Panel node.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}

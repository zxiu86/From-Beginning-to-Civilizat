import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0B0F14] p-6 text-center text-[#E6EDF3]">
      <h1 className="text-xl font-bold">404</h1>
      <p className="mt-2 text-sm text-[#9FB0C3]">Page not found — Civilization Observatory</p>
      <Link
        href="/"
        className="mt-4 rounded border border-[#D99B26] bg-[#D99B26]/15 px-4 py-2 text-xs font-semibold text-[#F2BE49]"
      >
        Return to Observatory
      </Link>
    </div>
  );
}

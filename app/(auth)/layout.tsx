import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex items-center justify-center space-x-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-xl font-bold text-white">
            A
          </div>
          <span className="text-2xl font-bold text-slate-900">AIGS LMS</span>
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="border border-slate-200 bg-white px-4 py-8 shadow-sm sm:rounded-lg sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}

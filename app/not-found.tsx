import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-extrabold text-slate-300">404</h1>
      <h2 className="mt-4 text-2xl font-bold text-slate-900">Page Not Found</h2>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        The requested resource, course, or lesson could not be located.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button>Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}

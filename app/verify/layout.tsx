import { PublicLayout } from "@/components/public/public-layout";

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout mainClassName="flex-1">
      {children}
    </PublicLayout>
  );
}

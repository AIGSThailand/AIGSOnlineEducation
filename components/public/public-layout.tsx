import { PublicHeader } from "@/components/public/header/public-header";
import { PublicFooter } from "@/components/public/footer/public-footer";

type PublicLayoutProps = {
  children: React.ReactNode;
  dashboardHref?: string;
  userLabel?: string;
  mainClassName?: string;
};

/** Shared public chrome: sticky header + main landmark + footer. */
export function PublicLayout({
  children,
  dashboardHref,
  userLabel,
  mainClassName = "flex-1",
}: PublicLayoutProps) {
  return (
    <div className="public-site flex min-h-screen flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <PublicHeader dashboardHref={dashboardHref} userLabel={userLabel} />
      <main id="main-content" className={mainClassName}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

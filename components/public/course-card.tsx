import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { wordpressContentToPlainText } from "@/lib/utils/wordpress-content";
import { cn } from "@/lib/utils";

export type PublicCourseCardData = {
  id: string;
  title: string;
  description?: string | null;
  excerpt?: string | null;
  thumbnail_url?: string | null;
  access_type?: string | null;
};

type PublicCourseCardProps = {
  course: PublicCourseCardData;
  enrolled?: boolean;
  className?: string;
};

function accessLabel(accessType: string | null | undefined): string | null {
  switch (accessType) {
    case "open":
      return "Open access";
    case "paid":
      return "Paid";
    case "enrollment_required":
      return "Enrollment";
    case "private":
      return "Private";
    default:
      return null;
  }
}

export function PublicCourseCard({ course, enrolled = false, className }: PublicCourseCardProps) {
  const summary =
    (course.excerpt && course.excerpt.trim()) ||
    wordpressContentToPlainText(course.description) ||
    "Explore the curriculum and discover what you will learn in this course.";
  const badge = enrolled ? "Enrolled" : accessLabel(course.access_type);

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--brand-dark)]">
        {course.thumbnail_url ? (
          // Migrated / external thumbnails may be absolute hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-[var(--brand-primary-muted)]" strokeWidth={1.25} aria-hidden />
          </div>
        )}
        {badge ? (
          <span className="absolute left-3 top-3 rounded-md bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-primary)] shadow-sm">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg font-semibold leading-snug tracking-tight text-[var(--text-primary)] sm:text-xl">
          {course.title}
        </h3>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-[var(--text-secondary)]">
          {summary}
        </p>
        <Link
          href={`/courses/${course.id}`}
          className="mt-5 flex min-h-11 items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm font-semibold text-[var(--brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
        >
          <span>
            {enrolled ? "Continue learning" : "View course"}
            <span className="sr-only">: {course.title}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function PublicCourseGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>
  );
}

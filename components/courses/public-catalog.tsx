"use client";

import { useMemo, useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { wordpressContentToPlainText, decodeHtmlEntities } from "@/lib/utils/wordpress-content";
import {
  PublicBundleCard,
  PublicCourseCard,
  PublicCourseGrid,
} from "@/components/public/course-card";
import { publicButtonClassName } from "@/components/public/public-button";
import type { PublicBundleCatalogItem } from "@/features/groups/types";
import type { Database } from "@/types/database.types";

type Course = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  "id" | "title" | "description" | "excerpt" | "thumbnail_url" | "access_type" | "created_at"
>;

type CatalogItem =
  | { kind: "course"; sortTitle: string; sortDate: string; course: Course }
  | {
      kind: "bundle";
      sortTitle: string;
      sortDate: string;
      bundle: PublicBundleCatalogItem;
    };

export function PublicCatalog({
  courses,
  bundles = [],
  enrolledCourseIds,
  ownedBundleIds = [],
  compact = false,
}: {
  courses: Course[];
  bundles?: PublicBundleCatalogItem[];
  enrolledCourseIds: string[];
  ownedBundleIds?: string[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const term = query.trim().toLowerCase();

  const items = useMemo(() => {
    const mapped: CatalogItem[] = [
      ...courses.map((course) => ({
        kind: "course" as const,
        sortTitle: decodeHtmlEntities(course.title),
        sortDate: course.created_at,
        course,
      })),
      ...bundles.map((bundle) => ({
        kind: "bundle" as const,
        sortTitle: decodeHtmlEntities(bundle.name),
        sortDate: bundle.updatedAt,
        bundle,
      })),
    ];

    const filtered = mapped.filter((item) => {
      if (!term) return true;
      if (item.kind === "course") {
        return `${item.sortTitle} ${wordpressContentToPlainText(item.course.description)} ${item.course.excerpt || ""}`
          .toLowerCase()
          .includes(term);
      }
      return `${item.sortTitle} ${wordpressContentToPlainText(item.bundle.description)}`
        .toLowerCase()
        .includes(term);
    });

    if (sort === "title") {
      filtered.sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));
    } else {
      filtered.sort(
        (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
      );
    }
    return filtered;
  }, [courses, bundles, term, sort]);

  const totalCount = courses.length + bundles.length;
  const courseMatchCount = items.filter((i) => i.kind === "course").length;
  const bundleMatchCount = items.filter((i) => i.kind === "bundle").length;

  return (
    <>
      {!compact && (
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="course-search"
              className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Find a course or bundle
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-3 h-5 w-5 text-[var(--text-secondary)]"
                aria-hidden
              />
              <input
                id="course-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title or topic"
                className="h-11 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="course-sort"
              className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Sort by
            </label>
            <select
              id="course-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-11 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] sm:w-48"
            >
              <option value="newest">Newest first</option>
              <option value="title">Title: A–Z</option>
            </select>
          </div>
        </div>
      )}
      <p role="status" className="mb-5 text-sm text-[var(--text-secondary)]">
        {items.length === 0
          ? `0 results${term ? ` matching “${query.trim()}”` : ""}`
          : [
              courseMatchCount
                ? `${courseMatchCount} ${courseMatchCount === 1 ? "course" : "courses"}`
                : null,
              bundleMatchCount
                ? `${bundleMatchCount} ${bundleMatchCount === 1 ? "bundle" : "bundles"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
        {term && items.length > 0 ? ` matching “${query.trim()}”` : items.length > 0 ? " to explore" : ""}
      </p>
      {items.length ? (
        <PublicCourseGrid>
          {items.map((item) =>
            item.kind === "course" ? (
              <PublicCourseCard
                key={`course-${item.course.id}`}
                course={item.course}
                enrolled={enrolledCourseIds.includes(item.course.id)}
              />
            ) : (
              <PublicBundleCard
                key={`bundle-${item.bundle.id}`}
                bundle={item.bundle}
                owned={ownedBundleIds.includes(item.bundle.id)}
              />
            )
          )}
        </PublicCourseGrid>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-16 text-center">
          <BookOpen className="mx-auto mb-5 h-8 w-8 text-[var(--brand-primary)]" aria-hidden />
          <h2 className="text-xl font-semibold">
            {totalCount ? "No matching courses or bundles" : "New learning opportunities are on the way"}
          </h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {totalCount
              ? "Try a different title or a broader topic."
              : "Please check back soon to explore our courses and bundles."}
          </p>
          {totalCount > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className={publicButtonClassName("primary", "mt-6")}
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </>
  );
}

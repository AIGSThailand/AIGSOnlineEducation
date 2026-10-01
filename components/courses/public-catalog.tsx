"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, BookOpen, List, LayoutGrid } from "lucide-react";
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
> & { price?: string | null };

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
  initialQuery = "",
  initialKind,
  initialSort,
}: {
  courses: Course[];
  bundles?: PublicBundleCatalogItem[];
  enrolledCourseIds: string[];
  ownedBundleIds?: string[];
  compact?: boolean;
  initialQuery?: string;
  initialKind?: string;
  initialSort?: string;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort === "title" ? "title" : "newest");
  const [kind, setKind] = useState(
    initialKind === "course" || initialKind === "bundle" ? initialKind : "all"
  );
  useEffect(() => {
    setQuery(initialQuery);
    setKind(initialKind === "course" || initialKind === "bundle" ? initialKind : "all");
    setSort(initialSort === "title" ? "title" : "newest");
  }, [initialQuery, initialKind, initialSort]);
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
      if (kind !== "all" && item.kind !== kind) return false;
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
      filtered.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    }
    return filtered;
  }, [courses, bundles, term, sort, kind]);

  const totalCount = courses.length + bundles.length;
  const courseMatchCount = items.filter((i) => i.kind === "course").length;
  const bundleMatchCount = items.filter((i) => i.kind === "bundle").length;

  return (
    <div>
      {!compact && (
        <form
          action="/courses"
          className="mx-auto mb-10 flex max-w-2xl border border-[var(--border-strong)] bg-white"
        >
          <label htmlFor="course-search" className="sr-only">
            Search courses and bundles
          </label>
          <input
            id="course-search"
            name="q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses and bundles"
            className="min-w-0 flex-1 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          />
          <button
            type="submit"
            aria-label="Search catalog"
            className="flex items-center bg-brand-600 px-4 text-white hover:bg-brand-700"
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="sort" value={sort} />
        </form>
      )}
      {!compact && (
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="mb-4 min-h-11 border border-[var(--border)] px-4 text-sm font-bold lg:hidden"
        >
          {filtersOpen ? "Hide filters" : "Show filters"}
        </button>
      )}
      <div className={compact ? "" : "grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)]"}>
        {!compact && (
          <aside
            id="catalog-filters"
            className={`${filtersOpen ? "block" : "hidden"} border-t border-[var(--border)] bg-[var(--surface-muted)] p-5 lg:sticky lg:top-28 lg:block`}
            aria-label="Catalog filters"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="font-bold">Filters</h2>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setKind("all");
                  setSort("newest");
                }}
                className="min-h-11 text-xs underline underline-offset-4"
              >
                Clear all
              </button>
            </div>
            <fieldset>
              <legend className="mb-3 text-sm font-bold">Learning format</legend>
              {[
                ["all", "All learning"],
                ["course", "Individual courses"],
                ["bundle", "Course bundles"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
                >
                  <input
                    type="radio"
                    name="learning-format"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                    className="h-4 w-4 accent-[var(--brand-primary)]"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <p className="mt-6 border-t border-[var(--border)] pt-5 text-xs leading-6 text-[var(--text-secondary)]">
              Open a course to explore its curriculum, available previews, and enrollment options.
            </p>
          </aside>
        )}
        <div className="min-w-0">
          {!compact && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <h2 className="border-b-2 border-brand-600 py-2 text-sm font-bold uppercase">
                Courses &amp; bundles
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="course-sort" className="text-sm">
                  Sort by
                </label>
                <select
                  id="course-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="min-h-11 border border-[var(--border)] bg-white px-3 text-sm"
                >
                  <option value="newest">Newest first</option>
                  <option value="title">Title: A–Z</option>
                </select>
                <div className="flex" aria-label="Results display">
                  {(
                    [
                      ["list", List],
                      ["grid", LayoutGrid],
                    ] as const
                  ).map(([mode, Icon]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-label={mode === "list" ? "List view" : "Grid view"}
                      aria-pressed={view === mode}
                      onClick={() => setView(mode)}
                      className={`flex h-11 w-11 items-center justify-center border border-[var(--border)] ${view === mode ? "bg-brand-600 text-white" : "bg-white text-[var(--text-secondary)]"}`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
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
            {term && items.length > 0
              ? ` matching “${query.trim()}”`
              : items.length > 0
                ? " to explore"
                : ""}
          </p>
          {items.length ? (
            <PublicCourseGrid
              className={
                !compact && view === "list"
                  ? "catalog-list !grid-cols-1 gap-4"
                  : !compact
                    ? "lg:grid-cols-2"
                    : undefined
              }
            >
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
            <div className="rounded-sm border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-16 text-center">
              <BookOpen className="mx-auto mb-5 h-8 w-8 text-[var(--brand-primary)]" aria-hidden />
              <h2 className="text-xl font-semibold">
                {totalCount
                  ? "No matching courses or bundles"
                  : "New learning opportunities are on the way"}
              </h2>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {totalCount
                  ? "Try a different title or a broader topic."
                  : "Please check back soon to explore our courses and bundles."}
              </p>
              {totalCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setKind("all");
                  }}
                  className={publicButtonClassName("primary", "mt-6")}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

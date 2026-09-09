"use client";

import { useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { wordpressContentToPlainText } from "@/lib/utils/wordpress-content";
import { PublicCourseCard, PublicCourseGrid } from "@/components/public/course-card";
import { publicButtonClassName } from "@/components/public/public-button";
import type { Database } from "@/types/database.types";

type Course = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  "id" | "title" | "description" | "excerpt" | "thumbnail_url" | "access_type" | "created_at"
>;

export function PublicCatalog({
  courses,
  enrolledCourseIds,
  compact = false,
}: {
  courses: Course[];
  enrolledCourseIds: string[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const term = query.trim().toLowerCase();
  const filtered = courses.filter((course) =>
    `${course.title} ${wordpressContentToPlainText(course.description)} ${course.excerpt || ""}`
      .toLowerCase()
      .includes(term)
  );
  if (sort === "title") filtered.sort((a, b) => a.title.localeCompare(b.title));

  return (
    <>
      {!compact && (
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="course-search"
              className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Find a course
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
              <option value="title">Course title: A–Z</option>
            </select>
          </div>
        </div>
      )}
      <p role="status" className="mb-5 text-sm text-[var(--text-secondary)]">
        {filtered.length} {filtered.length === 1 ? "course" : "courses"}
        {term ? ` matching “${query.trim()}”` : " to explore"}
      </p>
      {filtered.length ? (
        <PublicCourseGrid>
          {filtered.map((course) => (
            <PublicCourseCard
              key={course.id}
              course={course}
              enrolled={enrolledCourseIds.includes(course.id)}
            />
          ))}
        </PublicCourseGrid>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-16 text-center">
          <BookOpen className="mx-auto mb-5 h-8 w-8 text-[var(--brand-primary)]" aria-hidden />
          <h2 className="text-xl font-semibold">
            {courses.length ? "No matching courses" : "New learning opportunities are on the way"}
          </h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {courses.length
              ? "Try a different title or a broader topic."
              : "Please check back soon to explore our courses."}
          </p>
          {courses.length > 0 && (
            <button type="button" onClick={() => setQuery("")} className={publicButtonClassName("primary", "mt-6")}>
              Clear search
            </button>
          )}
        </div>
      )}
    </>
  );
}

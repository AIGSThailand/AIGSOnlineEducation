"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function CourseContentsNav({ modules }: { modules: { id: string; title: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <nav
      aria-label="Course sections"
      className="border border-[var(--border)] bg-[var(--surface-muted)] p-5 lg:sticky lg:top-28"
    >
      <h2 className="hidden text-sm font-bold uppercase lg:block">Course contents</h2>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="course-contents-links"
        onClick={() => setExpanded(!expanded)}
        className="flex min-h-11 w-full items-center justify-between text-sm font-bold uppercase lg:hidden"
      >
        Course contents{" "}
        <ChevronDown className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div id="course-contents-links" className={`${expanded ? "block" : "hidden"} mt-4 lg:block`}>
        <a href="#overview" className="block py-3 text-sm font-bold text-brand-700 hover:underline">
          Overview
        </a>
        <a
          href="#curriculum"
          className="block border-t border-[var(--border)] py-3 text-sm font-bold hover:underline"
        >
          Curriculum
        </a>
        <div className="max-h-64 overflow-y-auto lg:max-h-[45vh]">
          {modules.map((module, index) => (
            <a
              key={module.id}
              href={`#module-${module.id}`}
              className="block border-t border-[var(--border)] py-3 text-sm leading-5 text-[var(--text-secondary)] hover:text-brand-700"
            >
              <span className="mr-2 text-xs">{String(index + 1).padStart(2, "0")}</span>
              {module.title}
            </a>
          ))}
        </div>
        <a
          href="#enrollment"
          className="block border-t border-[var(--border)] py-3 text-sm font-bold text-brand-700 hover:underline"
        >
          Enrollment &amp; access
        </a>
      </div>
    </nav>
  );
}

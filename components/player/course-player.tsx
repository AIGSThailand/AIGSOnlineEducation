"use client";

import { useState } from "react";
import Link from "next/link";
import { List, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlayerSidebar } from "./player-sidebar";
import { PlayerNav } from "./player-nav";
import { PlayerCompleteButton } from "./player-complete-button";
import { adjacentSteps } from "@/features/player/build-player";
import type { CoursePlayerData, PlayerStep } from "@/features/player/types";

interface CoursePlayerProps {
  player: CoursePlayerData;
  current: PlayerStep;
  lockedKeys: string[];
  canToggleComplete: boolean;
  children: React.ReactNode;
}

export function CoursePlayer({
  player,
  current,
  lockedKeys,
  canToggleComplete,
  children,
}: CoursePlayerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const completedSet = new Set(player.completedKeys);
  const lockedSet = new Set(lockedKeys);
  const { prev, next } = adjacentSteps(player.flatSteps, current.key);
  const completedCount = player.completedKeys.length;
  const total = player.flatSteps.length;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  const isCompleted = completedSet.has(current.key);
  const nextLocked = next ? lockedSet.has(next.key) : false;

  const closeMenu = () => setMenuOpen(false);

  const sidebar = (
    <PlayerSidebar
      courseId={player.courseId}
      courseTitle={player.courseTitle}
      sections={player.sections}
      currentKey={current.key}
      completedKeys={completedSet}
      lockedKeys={lockedSet}
      onNavigate={closeMenu}
    />
  );

  return (
    <div className="public-site fixed inset-0 z-50 flex bg-[var(--surface)] text-[var(--text-primary)]">
      <aside className="hidden h-full w-[19rem] shrink-0 lg:flex">{sidebar}</aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--brand-dark)]/40"
            aria-label="Close syllabus"
            onClick={closeMenu}
          />
          <div className="relative z-50 h-full w-[19rem] max-w-[88vw] shadow-xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top progress + Mark Complete (LearnDash-style) */}
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-5">
            <button
              type="button"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-[var(--border)] lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open syllabus"
            >
              <List className="h-5 w-5" aria-hidden />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                {percent}% complete
                <span className="ml-2 font-medium normal-case tracking-normal">
                  {completedCount}/{total} steps
                </span>
              </p>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Course progress"
              >
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)] transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {canToggleComplete ? (
              <PlayerCompleteButton
                courseId={player.courseId}
                current={current}
                completed={isCompleted}
              />
            ) : null}

            {menuOpen ? (
              <button
                type="button"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-[var(--border)] lg:hidden"
                onClick={closeMenu}
                aria-label="Close syllabus"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            ) : null}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Link
                  href={`/courses/${player.courseId}`}
                  className="hover:text-[var(--brand-primary)]"
                >
                  {player.courseTitle}
                </Link>
                <span aria-hidden="true">/</span>
                <span className="text-[var(--text-primary)]">{current.title}</span>
                <Badge
                  variant={isCompleted ? "success" : "default"}
                  className="ml-1 uppercase tracking-wide"
                >
                  {isCompleted ? "Complete" : "In progress"}
                </Badge>
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                {current.title}
              </h1>
            </div>

            {children}

            <div className="border-t border-[var(--border)] pt-6">
              <PlayerNav prev={prev} next={next} nextLocked={nextLocked} />
              <p className="mt-5 text-center">
                <Link
                  href={`/courses/${player.courseId}`}
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--brand-primary)]"
                >
                  Back to course overview
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { List, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlayerSidebar } from "./player-sidebar";
import { PlayerNav } from "./player-nav";
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

  const sidebar = (
    <PlayerSidebar
      courseId={player.courseId}
      courseTitle={player.courseTitle}
      sections={player.sections}
      currentKey={current.key}
      completedKeys={completedSet}
      lockedKeys={lockedSet}
    />
  );

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden">
      <aside className="hidden h-full w-80 flex-shrink-0 lg:flex">{sidebar}</aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close syllabus"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-50 h-full w-80 max-w-[85vw] shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="border-b border-slate-200">
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-slate-600">
            <button
              type="button"
              className="inline-flex items-center rounded-md p-1.5 hover:bg-slate-100 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open syllabus"
            >
              <List className="h-5 w-5" />
            </button>
            <p className="font-semibold text-slate-800">
              {percent}% complete
              <span className="ml-2 font-normal text-slate-500">
                {completedCount}/{total} steps
              </span>
            </p>
            <Link
              href={`/courses/${player.courseId}`}
              className="hidden text-xs font-medium text-brand-600 hover:text-brand-700 sm:inline"
            >
              Back to course
            </Link>
            {menuOpen ? (
              <button type="button" className="lg:hidden" onClick={() => setMenuOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            ) : (
              <span className="w-6 lg:hidden" />
            )}
          </div>
          <div className="h-1 bg-slate-100">
            <div
              className="h-1 bg-emerald-500 transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Link href={`/courses/${player.courseId}`} className="hover:text-brand-600">
                  {player.courseTitle}
                </Link>
                <span aria-hidden="true">›</span>
                <span className="text-slate-700">{current.title}</span>
                {isCompleted && (
                  <Badge variant="success" className="ml-1 normal-case">
                    Complete
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{current.title}</h1>
            </div>

            {children}

            <div className="border-t border-slate-100 pt-6">
              <PlayerNav
                courseId={player.courseId}
                current={current}
                prev={prev}
                next={next}
                completed={isCompleted}
                nextLocked={nextLocked}
                canToggleComplete={canToggleComplete}
              />
              <p className="mt-4 text-center">
                <Link
                  href={`/courses/${player.courseId}`}
                  className="text-xs font-medium text-slate-500 hover:text-brand-600"
                >
                  Back to course
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

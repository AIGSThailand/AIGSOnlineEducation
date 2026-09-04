/**
 * LearnDash → Supabase Phase 2 Migration Script
 *
 * Imports LearnDash .ld exports into the Phase 2 schema:
 *   courses → course_sections → lessons (reusable) → course_steps (tree)
 *   + quiz stubs when referenced in ld_course_steps (full quiz import needs quiz export)
 *
 * Also mirrors course_sections → modules for Phase 1 UI backward compatibility.
 *
 * Usage:
 *   node scripts/migrate-learndash.mjs [--dry-run] [--skip-steps-rebuild]
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { wordpressContentToHtml } from './lib/wordpress-content.mjs';
import { loadCliEnv, parseEnvFlag } from './lib/load-cli-env.mjs';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
let envName;
try {
  envName = parseEnvFlag(process.argv);
  const loaded = loadCliEnv(envName);
  console.log(`env file=${loaded.filePath} (--env ${envName})`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    `Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.${envName}`
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isDryRun = process.argv.includes('--dry-run');
const skipStepsRebuild = process.argv.includes('--skip-steps-rebuild');
const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Export folder discovery
// ---------------------------------------------------------------------------
const baseDir = path.resolve(process.cwd(), 'learndash_data');
if (!fs.existsSync(baseDir)) {
  console.error('learndash_data/ folder not found.');
  process.exit(1);
}

const folders = fs
  .readdirSync(baseDir)
  .filter((f) => fs.statSync(path.join(baseDir, f)).isDirectory());

const courseFolder = folders.find((f) => f.includes('course'));
const lessonFolder = folders.find((f) => f.includes('lesson'));

if (!courseFolder || !lessonFolder) {
  console.error('Could not find course and lesson export folders in learndash_data/');
  process.exit(1);
}

const courseDirPath = path.join(baseDir, courseFolder);
const lessonDirPath = path.join(baseDir, lessonFolder);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function readLdLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, idx) => {
      try {
        return JSON.parse(line);
      } catch {
        console.warn(`Skipping invalid JSON at ${filePath}:${idx + 1}`);
        return null;
      }
    })
    .filter(Boolean);
}

function sanitizeSlug(slug, fallback) {
  let value = slug || fallback;
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep */
  }
  value = value
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5\u0e00-\u0e7f-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
  return value || `item-${fallback}`;
}

function mapCourseStatus(postStatus) {
  if (postStatus === 'publish') return 'published';
  if (postStatus === 'archived') return 'archived';
  return 'draft';
}

function mapContentStatus(postStatus) {
  if (postStatus === 'publish') return 'published';
  if (postStatus === 'private') return 'draft';
  return 'draft';
}

function isoFromGmt(gmt) {
  if (!gmt || gmt.startsWith('0000')) return new Date().toISOString();
  const d = new Date(`${gmt}Z`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function extractVideoUrl(content, meta, lessonMetaKey = '_sfwd-lessons') {
  const settings = meta?.[lessonMetaKey]?.[0];
  const metaUrl =
    settings?.[`${lessonMetaKey}_lesson_video_url`] ||
    settings?.['sfwd-lessons_lesson_video_url'];
  if (metaUrl?.trim()) return metaUrl.trim();
  if (!content) return null;

  const patterns = [
    /<video[^>]*src=["']([^"']+)["']/i,
    /<iframe[^>]*src=["']([^"']+)["']/i,
    /(https?:\/\/[^\s"'<>]+\.(?:mp4|webm|m3u8))/i,
  ];
  for (const re of patterns) {
    const m = content.match(re);
    if (m) return m[1];
  }
  return null;
}

function parseProgressionType(meta) {
  const settings = meta?._sfwd_courses?.[0];
  const ldType = settings?.['sfwd-courses_course_prerequisite_compare'] ?? settings?.course_prerequisite_compare;
  // LearnDash linear progression when steps must be completed in order
  const linear =
    settings?.['sfwd-courses_course_disable_lesson_progression'] === 'on' ||
    settings?.['sfwd-courses_course_lesson_orderby'] === 'menu_order';
  if (linear) return 'linear';
  return 'free_form';
}

/** Which section array index (0-based) owns this 1-based builder step index. */
function resolveSectionIndex(stepIndex1Based, sections) {
  if (!sections.length) return 0;
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  let index = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].order <= stepIndex1Based) index = i;
    else break;
  }
  return index;
}

function findPrimaryCourseForLesson(wpLessonId) {
  for (const [wpCourseId, { tree }] of courseBuilderMap) {
    if (tree?.['sfwd-lessons']?.[String(wpLessonId)]) return wpCourseId;
  }
  const content = lessonContentByWpId.get(wpLessonId);
  return content?.wordpress_course_id ?? null;
}

function collectNestedIds(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.map(Number).filter(Boolean);
  if (typeof node === 'object') return Object.keys(node).map(Number).filter(Boolean);
  return [];
}

// ---------------------------------------------------------------------------
// Step 1 — Media index
// ---------------------------------------------------------------------------
console.log('\n--- Step 1: Media index ---');
const mediaMap = new Map();

for (const file of ['media.ld']) {
  for (const dir of [courseDirPath, lessonDirPath]) {
    for (const row of readLdLines(path.join(dir, file))) {
      const id = String(row.ID ?? row.wp_post?.ID ?? '');
      const url = row.url || row.guid || (row.filename ? row.url : null);
      if (id && url) mediaMap.set(id, url);
    }
  }
}
console.log(`Indexed ${mediaMap.size} media references.`);

// ---------------------------------------------------------------------------
// Step 2 — Parse courses + builder trees
// ---------------------------------------------------------------------------
console.log('\n--- Step 2: Parse courses ---');
const usedCourseSlugs = new Set();
const parsedCourses = [];
/** @type {Map<number, { sections: object[], tree: object|null }>} */
const courseBuilderMap = new Map();

for (const raw of readLdLines(path.join(courseDirPath, 'post_type_course.ld'))) {
  const post = raw.wp_post;
  const meta = raw.wp_post_meta || {};
  const wpCourseId = Number(post.ID);

  let slug = sanitizeSlug(post.post_name || post.post_title, `course-${wpCourseId}`);
  if (usedCourseSlugs.has(slug)) slug = `${slug}-${wpCourseId}`;
  usedCourseSlugs.add(slug);

  let sections = [];
  if (meta.course_sections?.[0]) {
    try {
      const rawSections = JSON.parse(meta.course_sections[0]);
      sections = rawSections.map((s, idx) => ({
        title: s.post_title || `Section ${idx + 1}`,
        order: Number(s.order) || idx + 1,
        wordpress_section_id: s.ID ? Number(s.ID) : null,
      }));
    } catch {
      sections = [];
    }
  }

  const tree = meta.ld_course_steps?.[0]?.steps?.h ?? null;
  courseBuilderMap.set(wpCourseId, { sections, tree });

  parsedCourses.push({
    wordpress_course_id: wpCourseId,
    title: post.post_title || `Course #${wpCourseId}`,
    slug,
    description: wordpressContentToHtml(post.post_content || ''),
    excerpt: post.post_excerpt || null,
    status: mapCourseStatus(post.post_status),
    progression_type: parseProgressionType(meta),
    thumbnail_url: meta._thumbnail_id?.[0]
      ? mediaMap.get(String(meta._thumbnail_id[0])) ?? null
      : null,
    created_at: isoFromGmt(post.post_date_gmt),
    updated_at: isoFromGmt(post.post_modified_gmt),
  });
}

console.log(`Parsed ${parsedCourses.length} courses.`);

// ---------------------------------------------------------------------------
// Step 3 — Parse lessons (content bank)
// ---------------------------------------------------------------------------
console.log('\n--- Step 3: Parse lesson content ---');
/** @type {Map<number, object>} */
const lessonContentByWpId = new Map();

for (const raw of readLdLines(path.join(lessonDirPath, 'post_type_lesson.ld'))) {
  const post = raw.wp_post;
  const meta = raw.wp_post_meta || {};
  const wpLessonId = Number(post.ID);
  const wpCourseId = Number(
    meta.course_id?.[0] || meta['_sfwd-lessons']?.[0]?.['sfwd-lessons_course'] || 0
  );

  lessonContentByWpId.set(wpLessonId, {
    wordpress_lesson_id: wpLessonId,
    wordpress_course_id: wpCourseId || null,
    title: post.post_title || `Lesson #${wpLessonId}`,
    slug: sanitizeSlug(post.post_name || post.post_title, `lesson-${wpLessonId}`),
    content: wordpressContentToHtml(post.post_content || ''),
    excerpt: post.post_excerpt || null,
    video_url: extractVideoUrl(post.post_content, meta),
    status: mapContentStatus(post.post_status),
    created_at: isoFromGmt(post.post_date_gmt),
    updated_at: isoFromGmt(post.post_modified_gmt),
  });
}

console.log(`Parsed ${lessonContentByWpId.size} lesson records from export.`);

// Collect all WP IDs referenced in course builder trees
const referencedLessonIds = new Set();
const referencedQuizIds = new Set();

for (const { tree } of courseBuilderMap.values()) {
  if (!tree) continue;
  for (const wpLessonId of collectNestedIds(tree['sfwd-lessons'])) {
    referencedLessonIds.add(wpLessonId);
  }
  for (const wpQuizId of collectNestedIds(tree['sfwd-quiz'])) {
    referencedQuizIds.add(wpQuizId);
  }
  const lessonsTree = tree['sfwd-lessons'] || {};
  for (const lessonNode of Object.values(lessonsTree)) {
    for (const wpQuizId of collectNestedIds(lessonNode?.['sfwd-quiz'])) {
      referencedQuizIds.add(wpQuizId);
    }
    for (const wpTopicId of collectNestedIds(lessonNode?.['sfwd-topic'])) {
      /* topics export not bundled — counted for future importer */
    }
  }
}

console.log(
  `Builder references: ${referencedLessonIds.size} lessons, ${referencedQuizIds.size} quizzes (stubs if no quiz export).`
);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
async function upsertBatch(table, rows, options = {}) {
  if (!rows.length) return { count: 0, error: null };
  const { error } = await supabase.from(table).upsert(rows, options);
  return { count: rows.length, error };
}

async function runMigration() {
  const stats = {
    courses: 0,
    sections: 0,
    modulesMirrored: 0,
    lessons: 0,
    quizzes: 0,
    courseSteps: 0,
    stepsDeleted: 0,
    stepsSkippedMissingLesson: 0,
  };

  if (isDryRun) {
    console.log('\n=== DRY RUN ===');
    console.log(`Courses:              ${parsedCourses.length}`);
    console.log(`Lesson content rows:  ${lessonContentByWpId.size}`);
    console.log(`Referenced lessons:   ${referencedLessonIds.size}`);
    console.log(`Referenced quizzes:   ${referencedQuizIds.size}`);
    console.log(
      `Course sections total: ${[...courseBuilderMap.values()].reduce((n, c) => n + (c.sections.length || 1), 0)}`
    );
    return;
  }

  /** @type {Map<number, string>} wpCourseId → uuid */
  const courseUuidMap = new Map();
  /** @type {Map<number, string>} wpLessonId → uuid */
  const lessonUuidMap = new Map();
  /** @type {Map<number, string>} wpQuizId → uuid */
  const quizUuidMap = new Map();

  // ---- Courses ----
  console.log('\n--- Step 4: Upsert courses ---');
  for (const course of parsedCourses) {
    const { data, error } = await supabase
      .from('courses')
      .upsert(course, { onConflict: 'wordpress_course_id' })
      .select('id, wordpress_course_id')
      .single();

    if (error) {
      console.error(`Course ${course.wordpress_course_id}: ${error.message}`);
      continue;
    }
    courseUuidMap.set(course.wordpress_course_id, data.id);
    stats.courses++;
    console.log(`✓ ${course.title}`);
  }

  // ---- Sections (+ mirror modules for Phase 1 UI) ----
  console.log('\n--- Step 5: Upsert course_sections (+ modules mirror) ---');
  /** @type {Map<string, string[]>} courseUuid → section uuids by index */
  const sectionUuidsByCourse = new Map();

  for (const [wpCourseId, courseUuid] of courseUuidMap) {
    const builder = courseBuilderMap.get(wpCourseId);
    let sections = builder?.sections?.length
      ? builder.sections
      : [{ title: 'Course Content', order: 1, wordpress_section_id: null }];

    const sectionIds = [];

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const sectionRow = {
        course_id: courseUuid,
        title: sec.title,
        sort_order: sec.order ?? i + 1,
        wordpress_section_id: sec.wordpress_section_id,
      };

      const { data: existing } = await supabase
        .from('course_sections')
        .select('id')
        .eq('course_id', courseUuid)
        .eq('sort_order', sectionRow.sort_order)
        .maybeSingle();

      let sectionId = existing?.id;

      if (sectionId) {
        await supabase.from('course_sections').update(sectionRow).eq('id', sectionId);
      } else {
        const { data: inserted, error } = await supabase
          .from('course_sections')
          .insert(sectionRow)
          .select('id')
          .single();
        if (error) {
          console.error(`Section "${sec.title}": ${error.message}`);
          continue;
        }
        sectionId = inserted.id;
      }

      sectionIds[i] = sectionId;
      stats.sections++;

      // Mirror to deprecated modules table (Phase 1 syllabus UI)
      const moduleRow = {
        id: sectionId,
        course_id: courseUuid,
        title: sec.title,
        sort_order: sectionRow.sort_order,
      };
      const { error: modErr } = await supabase.from('modules').upsert(moduleRow, { onConflict: 'id' });
      if (!modErr) stats.modulesMirrored++;
    }

    sectionUuidsByCourse.set(courseUuid, sectionIds);
  }

  console.log(`✓ ${stats.sections} sections, ${stats.modulesMirrored} modules mirrored.`);

  // ---- Lessons (reusable content bank) ----
  console.log('\n--- Step 6: Upsert lessons (reusable content) ---');
  const lessonIdsToImport = new Set([...referencedLessonIds, ...lessonContentByWpId.keys()]);

  const lessonRows = [];
  let skippedOrphanLessons = 0;

  for (const wpLessonId of lessonIdsToImport) {
    const content = lessonContentByWpId.get(wpLessonId) || {
      wordpress_lesson_id: wpLessonId,
      title: `Lesson #${wpLessonId}`,
      slug: `lesson-${wpLessonId}`,
      content: '',
      excerpt: null,
      video_url: null,
      status: 'draft',
      wordpress_course_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const primaryWpCourse =
      content.wordpress_course_id || findPrimaryCourseForLesson(wpLessonId);
    const primaryCourseUuid = primaryWpCourse
      ? courseUuidMap.get(primaryWpCourse)
      : null;

    if (!primaryCourseUuid) {
      skippedOrphanLessons++;
      continue;
    }

    lessonRows.push({
      title: content.title,
      slug: `${content.slug}-${wpLessonId}`,
      content: content.content,
      excerpt: content.excerpt,
      video_url: content.video_url,
      status: content.status,
      wordpress_lesson_id: wpLessonId,
      course_id: primaryCourseUuid,
      module_id: null,
      sort_order: 0,
      updated_at: content.updated_at,
    });
  }

  for (let i = 0; i < lessonRows.length; i += BATCH_SIZE) {
    const chunk = lessonRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('lessons').upsert(chunk, { onConflict: 'wordpress_lesson_id' });
    if (error) {
      console.error(`Lesson batch @${i}: ${error.message}`);
    } else {
      stats.lessons += chunk.length;
      process.stdout.write(`\r  Lessons upserted: ${stats.lessons}/${lessonRows.length}`);
    }
  }
  console.log('');

  if (skippedOrphanLessons > 0) {
    console.log(
      `  (${skippedOrphanLessons} orphan lessons skipped — not linked to exported courses)`
    );
  }

  // Load lesson UUID map (chunked — a single .in() of 1k+ ids exceeds PostgREST URL limits)
  const lessonIdList = [...lessonIdsToImport];
  const IN_CHUNK = 100;
  for (let i = 0; i < lessonIdList.length; i += IN_CHUNK) {
    const slice = lessonIdList.slice(i, i + IN_CHUNK);
    const { data: lessonRowsDb, error: mapErr } = await supabase
      .from('lessons')
      .select('id, wordpress_lesson_id')
      .in('wordpress_lesson_id', slice);
    if (mapErr) {
      console.error(`Lesson UUID map chunk @${i}: ${mapErr.message}`);
      continue;
    }
    for (const row of lessonRowsDb || []) {
      if (row.wordpress_lesson_id) lessonUuidMap.set(Number(row.wordpress_lesson_id), row.id);
    }
  }
  console.log(`  Lesson UUID map size: ${lessonUuidMap.size}/${lessonIdList.length}`);
  if (lessonUuidMap.size === 0 && lessonIdList.length > 0) {
    console.error(
      'FATAL: lesson UUID map is empty — course_steps would be skipped. Aborting before deleting steps.'
    );
    process.exit(1);
  }

  // ---- Quiz stubs ----
  console.log('\n--- Step 7: Upsert quiz stubs ---');
  for (const wpQuizId of referencedQuizIds) {
    const quizRow = {
      title: `Quiz #${wpQuizId}`,
      slug: `quiz-${wpQuizId}`,
      description: 'Imported stub — attach quiz export for full content.',
      status: 'draft',
      wordpress_quiz_id: wpQuizId,
    };
    const { data, error } = await supabase
      .from('quizzes')
      .upsert(quizRow, { onConflict: 'wordpress_quiz_id' })
      .select('id, wordpress_quiz_id')
      .single();
    if (!error && data) {
      quizUuidMap.set(wpQuizId, data.id);
      stats.quizzes++;
    }
  }
  console.log(`✓ ${stats.quizzes} quiz stubs.`);

  // ---- Course steps tree ----
  console.log('\n--- Step 8: Build course_steps trees ---');

  for (const [wpCourseId, courseUuid] of courseUuidMap) {
    const builder = courseBuilderMap.get(wpCourseId);
    const tree = builder?.tree;
    const sections = builder?.sections?.length
      ? builder.sections
      : [{ title: 'Course Content', order: 1 }];
    const sectionIds = sectionUuidsByCourse.get(courseUuid) || [];

    if (!skipStepsRebuild) {
      const { count, error } = await supabase
        .from('course_steps')
        .delete({ count: 'exact' })
        .eq('course_id', courseUuid);
      if (error) {
        console.error(`Delete steps course ${wpCourseId}: ${error.message}`);
      } else {
        stats.stepsDeleted += count || 0;
      }
    }

    if (!tree) continue;

    const lessonsTree = tree['sfwd-lessons'] || {};
    const orderedLessonWpIds = Object.keys(lessonsTree).map(Number);
    /** @type {Map<number, string>} wpLessonId → course_step.id */
    const lessonStepIds = new Map();

    // Top-level lessons
    for (let idx = 0; idx < orderedLessonWpIds.length; idx++) {
      const wpLessonId = orderedLessonWpIds[idx];
      const lessonUuid = lessonUuidMap.get(wpLessonId);
      if (!lessonUuid) {
        stats.stepsSkippedMissingLesson = (stats.stepsSkippedMissingLesson || 0) + 1;
        continue;
      }

      const stepIndex = idx + 1;
      const sectionIdx = resolveSectionIndex(stepIndex, sections);
      const sectionId = sectionIds[sectionIdx] || sectionIds[0] || null;

      const { data: step, error } = await supabase
        .from('course_steps')
        .insert({
          course_id: courseUuid,
          step_type: 'lesson',
          lesson_id: lessonUuid,
          section_id: sectionId,
          sort_order: stepIndex,
          is_required: true,
        })
        .select('id')
        .single();

      if (error) {
        console.error(`Lesson step ${wpLessonId} course ${wpCourseId}: ${error.message}`);
        continue;
      }

      lessonStepIds.set(wpLessonId, step.id);
      stats.courseSteps++;

      // Update deprecated lesson placement for Phase 1 UI (first course wins)
      await supabase
        .from('lessons')
        .update({
          course_id: courseUuid,
          module_id: sectionId,
          sort_order: stepIndex,
        })
        .eq('id', lessonUuid)
        .eq('wordpress_lesson_id', wpLessonId);

      // Nested quizzes under lesson
      const lessonNode = lessonsTree[String(wpLessonId)] || lessonsTree[wpLessonId];
      const quizWpIds = collectNestedIds(lessonNode?.['sfwd-quiz']);
      for (let qIdx = 0; qIdx < quizWpIds.length; qIdx++) {
        const wpQuizId = quizWpIds[qIdx];
        const quizUuid = quizUuidMap.get(wpQuizId);
        if (!quizUuid) continue;

        const { error: qErr } = await supabase.from('course_steps').insert({
          course_id: courseUuid,
          step_type: 'quiz',
          quiz_id: quizUuid,
          parent_step_id: step.id,
          section_id: sectionId,
          sort_order: qIdx + 1,
          is_required: true,
        });
        if (!qErr) stats.courseSteps++;
      }
    }

    // Course-level (final) quizzes
    const finalQuizWpIds = collectNestedIds(tree['sfwd-quiz']);
    for (let fIdx = 0; fIdx < finalQuizWpIds.length; fIdx++) {
      const wpQuizId = finalQuizWpIds[fIdx];
      const quizUuid = quizUuidMap.get(wpQuizId);
      if (!quizUuid) continue;

      const { error: fErr } = await supabase.from('course_steps').insert({
        course_id: courseUuid,
        step_type: 'quiz',
        quiz_id: quizUuid,
        parent_step_id: null,
        section_id: null,
        sort_order: orderedLessonWpIds.length + fIdx + 1,
        is_required: true,
      });
      if (!fErr) stats.courseSteps++;
    }
  }

  console.log(`✓ ${stats.courseSteps} course_steps created (${stats.stepsDeleted} old steps removed).`);
  if (stats.stepsSkippedMissingLesson > 0) {
    console.warn(`  ⚠ ${stats.stepsSkippedMissingLesson} lesson steps skipped (missing lesson UUID map entry)`);
  }

  console.log('\n🎉 Phase 2 LearnDash migration complete');
  console.log(`  Courses:        ${stats.courses}`);
  console.log(`  Sections:       ${stats.sections}`);
  console.log(`  Modules mirror: ${stats.modulesMirrored}`);
  console.log(`  Lessons:        ${stats.lessons}`);
  console.log(`  Quiz stubs:     ${stats.quizzes}`);
  console.log(`  Course steps:   ${stats.courseSteps}`);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

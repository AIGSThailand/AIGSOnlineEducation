/**
 * LearnDash Quiz & Question Import (Phase 2)
 *
 * Reads post_type_quiz.ld, post_type_question.ld, and proquiz.ld from
 * learndash_data/*question-quiz* export folder.
 *
 * - Upserts full quiz metadata (replaces stubs)
 * - Upserts questions + options (options when present in proquiz export)
 * - Links quiz_questions with sort order from WP menu_order
 *
 * Note: Most MCQ answer options live in ProQuiz DB tables. This export embeds
 * full answer data for ~194 questions only; the rest import as question text +
 * type without options until a DB export is available.
 *
 * Usage:
 *   node scripts/migrate-learndash-quizzes.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        process.env[key.trim()] = rest.join('=').trim();
      }
    });
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isDryRun = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

const baseDir = path.resolve(process.cwd(), 'learndash_data');
if (!fs.existsSync(baseDir)) {
  console.error('learndash_data/ folder not found.');
  process.exit(1);
}

const quizFolder = fs
  .readdirSync(baseDir)
  .filter((f) => fs.statSync(path.join(baseDir, f)).isDirectory())
  .find((f) => f.includes('question-quiz') || f.includes('quiz'));

if (!quizFolder) {
  console.error('No question-quiz export folder found in learndash_data/');
  process.exit(1);
}

const quizDirPath = path.join(baseDir, quizFolder);
console.log(`Using export folder: ${quizFolder}`);

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
        console.warn(`Invalid JSON in ${filePath}:${idx + 1}`);
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

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapQuestionType(wpType, proType) {
  const source = (proType || wpType || '').toLowerCase();
  const map = {
    single: 'single_choice',
    multiple: 'multiple_choice',
    essay: 'essay',
    free_answer: 'essay',
    assessment: 'assessment',
    cloze_answer: 'fill_blank',
    true_false: 'true_false',
  };
  return map[source] || 'single_choice';
}

function mapContentStatus(postStatus) {
  if (postStatus === 'publish') return 'published';
  return 'draft';
}

function decodeProquiz(data) {
  if (!data || typeof data !== 'string') return null;
  const match = data.match(/^WPQ\d+\.\d+/);
  if (!match) return null;
  try {
    return JSON.parse(Buffer.from(data.slice(match[0].length), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parse proquiz answer bank (keyed by WP question post ID)
// ---------------------------------------------------------------------------
console.log('\n--- Step 1: Parse proquiz.ld ---');
/** @type {Map<number, object>} */
const proQuizQuestionByPostId = new Map();

for (const row of readLdLines(path.join(quizDirPath, 'proquiz.ld'))) {
  const json = decodeProquiz(row.proquiz_data);
  if (!json?.question) continue;
  for (const [postId, question] of Object.entries(json.question)) {
    proQuizQuestionByPostId.set(Number(postId), question);
  }
}
console.log(`ProQuiz questions with embedded data: ${proQuizQuestionByPostId.size}`);

// ---------------------------------------------------------------------------
// Parse quizzes
// ---------------------------------------------------------------------------
console.log('\n--- Step 2: Parse quizzes ---');
const parsedQuizzes = [];
const usedQuizSlugs = new Set();

for (const raw of readLdLines(path.join(quizDirPath, 'post_type_quiz.ld'))) {
  const post = raw.wp_post;
  const meta = raw.wp_post_meta || {};
  const settings = meta['_sfwd-quiz']?.[0] || {};
  const wpQuizId = Number(post.ID);

  let slug = sanitizeSlug(post.post_name || post.post_title, `quiz-${wpQuizId}`);
  if (usedQuizSlugs.has(slug)) slug = `${slug}-${wpQuizId}`;
  usedQuizSlugs.add(slug);

  const passingRaw = Number(settings['sfwd-quiz_passingpercentage'] ?? settings.passingpercentage ?? 80);
  const timeLimitEnabled = settings['sfwd-quiz_quiz_time_limit_enabled'] === 'on';
  const timeLimit = Number(settings['sfwd-quiz_timeLimit'] ?? settings.timeLimit ?? 0);
  const repeats = settings['sfwd-quiz_repeats'] ?? settings.repeats ?? '';

  parsedQuizzes.push({
    wordpress_quiz_id: wpQuizId,
    title: post.post_title || `Quiz #${wpQuizId}`,
    slug,
    description: stripHtml(post.post_content) || null,
    status: mapContentStatus(post.post_status),
    passing_percentage: Number.isFinite(passingRaw) ? passingRaw : 80,
    time_limit_seconds: timeLimitEnabled && timeLimit > 0 ? timeLimit : null,
    max_attempts: repeats !== '' && Number(repeats) > 0 ? Number(repeats) : null,
    require_all_questions: settings['sfwd-quiz_forcingQuestionSolve'] === true,
    randomize_questions: settings['sfwd-quiz_quizModus'] === '1',
  });
}

console.log(`Parsed ${parsedQuizzes.length} quizzes.`);

// ---------------------------------------------------------------------------
// Parse questions
// ---------------------------------------------------------------------------
console.log('\n--- Step 3: Parse questions ---');
const wpQuizIds = new Set(parsedQuizzes.map((q) => q.wordpress_quiz_id));
/** @type {Map<number, object[]>} */
const questionsByWpQuizId = new Map();

const parsedQuestions = [];

for (const raw of readLdLines(path.join(quizDirPath, 'post_type_question.ld'))) {
  const post = raw.wp_post;
  const meta = raw.wp_post_meta || {};
  const wpQuestionId = Number(post.ID);
  const wpQuizId = Number(meta.quiz_id?.[0] || meta['_sfwd-question']?.[0]?.['sfwd-question_quiz'] || 0);

  if (!wpQuizId || !wpQuizIds.has(wpQuizId)) continue;

  const proQ = proQuizQuestionByPostId.get(wpQuestionId);
  const wpType = meta.question_type?.[0];
  const questionType = mapQuestionType(wpType, proQ?._answerType);

  const questionText =
    stripHtml(proQ?._question) ||
    stripHtml(post.post_content) ||
    post.post_title ||
    `Question #${wpQuestionId}`;

  const points = Number(proQ?._points ?? meta.question_points?.[0] ?? 1);

  const item = {
    wordpress_question_id: wpQuestionId,
    wordpress_quiz_id: wpQuizId,
    title: post.post_title || null,
    question_text: questionText,
    question_type: questionType,
    default_points: Number.isFinite(points) ? points : 1,
    explanation: stripHtml(proQ?._tipMsg) || null,
    menu_order: Number(post.menu_order) || 0,
    proAnswerData: proQ?._answerData || null,
  };

  parsedQuestions.push(item);

  if (!questionsByWpQuizId.has(wpQuizId)) questionsByWpQuizId.set(wpQuizId, []);
  questionsByWpQuizId.get(wpQuizId).push(item);
}

// Sort questions within each quiz (menu_order desc = typical LD ordering)
for (const [, list] of questionsByWpQuizId) {
  list.sort((a, b) => b.menu_order - a.menu_order || a.wordpress_question_id - b.wordpress_question_id);
}

const withOptions = parsedQuestions.filter(
  (q) => Array.isArray(q.proAnswerData) && q.proAnswerData.some((a) => a._answer?.trim())
).length;

console.log(`Parsed ${parsedQuestions.length} questions for exported quizzes.`);
console.log(`Questions with ProQuiz answer options: ${withOptions}`);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
async function runImport() {
  if (isDryRun) {
    console.log('\n=== DRY RUN ===');
    console.log(`Quizzes:    ${parsedQuizzes.length}`);
    console.log(`Questions:  ${parsedQuestions.length}`);
    console.log(`With opts:  ${withOptions}`);
    return;
  }

  const stats = {
    quizzes: 0,
    questions: 0,
    options: 0,
    quizQuestions: 0,
  };

  /** @type {Map<number, string>} */
  const quizUuidByWp = new Map();
  /** @type {Map<number, string>} */
  const questionUuidByWp = new Map();

  console.log('\n--- Step 4: Upsert quizzes ---');
  for (let i = 0; i < parsedQuizzes.length; i += BATCH_SIZE) {
    const chunk = parsedQuizzes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('quizzes').upsert(chunk, {
      onConflict: 'wordpress_quiz_id',
    });
    if (error) {
      console.error(`Quiz batch @${i}: ${error.message}`);
    } else {
      stats.quizzes += chunk.length;
    }
  }

  const { data: quizRows } = await supabase
    .from('quizzes')
    .select('id, wordpress_quiz_id')
    .in('wordpress_quiz_id', parsedQuizzes.map((q) => q.wordpress_quiz_id));

  for (const row of quizRows || []) {
    if (row.wordpress_quiz_id) quizUuidByWp.set(Number(row.wordpress_quiz_id), row.id);
  }
  console.log(`✓ ${quizUuidByWp.size} quizzes in database.`);

  console.log('\n--- Step 5: Upsert questions ---');
  for (let i = 0; i < parsedQuestions.length; i += BATCH_SIZE) {
    const chunk = parsedQuestions.slice(i, i + BATCH_SIZE).map((q) => ({
      wordpress_question_id: q.wordpress_question_id,
      title: q.title,
      question_text: q.question_text,
      question_type: q.question_type,
      default_points: q.default_points,
      explanation: q.explanation,
    }));

    const { error } = await supabase.from('questions').upsert(chunk, {
      onConflict: 'wordpress_question_id',
    });
    if (error) {
      console.error(`Question batch @${i}: ${error.message}`);
    } else {
      stats.questions += chunk.length;
      process.stdout.write(`\r  Questions: ${stats.questions}/${parsedQuestions.length}`);
    }
  }
  console.log('');

  for (let i = 0; i < parsedQuestions.length; i += BATCH_SIZE) {
    const ids = parsedQuestions.slice(i, i + BATCH_SIZE).map((q) => q.wordpress_question_id);
    const { data: batch } = await supabase
      .from('questions')
      .select('id, wordpress_question_id')
      .in('wordpress_question_id', ids);

    for (const row of batch || []) {
      if (row.wordpress_question_id) {
        questionUuidByWp.set(Number(row.wordpress_question_id), row.id);
      }
    }
  }

  console.log(`  Resolved ${questionUuidByWp.size} question UUIDs.`);

  console.log('\n--- Step 6: Upsert question options ---');
  for (const q of parsedQuestions) {
    const questionUuid = questionUuidByWp.get(q.wordpress_question_id);
    if (!questionUuid || !Array.isArray(q.proAnswerData)) continue;

    const answers = q.proAnswerData.filter((a) => a._answer?.trim());
    if (answers.length === 0) continue;

    // Replace options on re-run
    await supabase.from('question_options').delete().eq('question_id', questionUuid);

    const optionRows = answers.map((a, idx) => ({
      question_id: questionUuid,
      answer_text: a._answer.trim(),
      is_correct: a._correct === true || a._correct === '1' || a._correct === 1,
      sort_order: Number(a._sortString) || idx + 1,
      feedback: a._html ? stripHtml(a._answer) : null,
    }));

    const { error } = await supabase.from('question_options').insert(optionRows);
    if (!error) stats.options += optionRows.length;
  }
  console.log(`✓ ${stats.options} question options.`);

  console.log('\n--- Step 7: Link quiz_questions ---');
  const quizQuestionRows = [];

  for (const [wpQuizId, questions] of questionsByWpQuizId) {
    const quizUuid = quizUuidByWp.get(wpQuizId);
    if (!quizUuid) continue;

    questions.forEach((q, idx) => {
      const questionUuid = questionUuidByWp.get(q.wordpress_question_id);
      if (!questionUuid) return;
      quizQuestionRows.push({
        quiz_id: quizUuid,
        question_id: questionUuid,
        sort_order: idx + 1,
        points_override: q.default_points !== 1 ? q.default_points : null,
      });
    });
  }

  // Clear existing links for imported quizzes to avoid sort_order unique conflicts
  const quizUuids = [...new Set(quizQuestionRows.map((r) => r.quiz_id))];
  for (let i = 0; i < quizUuids.length; i += BATCH_SIZE) {
    const chunk = quizUuids.slice(i, i + BATCH_SIZE);
    await supabase.from('quiz_questions').delete().in('quiz_id', chunk);
  }

  for (let i = 0; i < quizQuestionRows.length; i += BATCH_SIZE) {
    const chunk = quizQuestionRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('quiz_questions').insert(chunk);
    if (error) {
      console.error(`quiz_questions batch @${i}: ${error.message}`);
    } else {
      stats.quizQuestions += chunk.length;
    }
  }

  console.log(`✓ ${stats.quizQuestions} quiz_question links.`);

  const missingOptions = parsedQuestions.length - withOptions;
  if (missingOptions > 0) {
    console.log(
      `\n⚠ ${missingOptions} questions imported without answer options (ProQuiz DB export not included in .ld file).`
    );
  }

  console.log('\n🎉 Quiz & question import complete');
  console.log(`  Quizzes:         ${stats.quizzes}`);
  console.log(`  Questions:       ${stats.questions}`);
  console.log(`  Options:         ${stats.options}`);
  console.log(`  Quiz↔Question:   ${stats.quizQuestions}`);
}

runImport().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});

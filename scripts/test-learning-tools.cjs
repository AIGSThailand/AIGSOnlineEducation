const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  ts = require("typescript");
const source = ts.transpileModule(fs.readFileSync("features/learning-tools/actions.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
let user = null,
  staff = false,
  access = true,
  exists = true,
  locked = false,
  written = null,
  dbError = null,
  touched = false;
const db = {
  from() {
    touched = true;
    return {
      insert: async (value) => {
        written = value;
        return { error: dbError };
      },
      delete: () => ({
        match: async (key) => {
          written = key;
          return { error: dbError };
        },
      }),
    };
  },
};
const out = {};
vm.runInNewContext(source, {
  exports: out,
  Set,
  require(name) {
    if (name === "zod") return require("zod");
    if (name.includes("supabase/server")) return { createClient: async () => db };
    if (name.includes("auth/permissions"))
      return { getCurrentUser: async () => user, canAccessCourse: async () => access };
    if (name.includes("courses/permissions")) return { canManageCourse: async () => staff };
    if (name.includes("queries"))
      return {
        getCoursePlayerData: async () => ({
          flatSteps: [],
          completedKeys: [],
          progressionType: "linear",
        }),
      };
    return {
      findStepByContent: () => (exists ? { key: "lesson" } : null),
      lockedStepKeys: () => new Set(locked ? ["lesson"] : []),
    };
  },
});
(async () => {
  const input = {
    courseId: "11111111-1111-4111-8111-111111111111",
    lessonId: "22222222-2222-4222-8222-222222222222",
    messageId: "33333333-3333-4333-8333-333333333333",
    body: "Question",
  };
  assert.ok((await out.sendLessonQuestion(input)).error);
  assert.equal(touched, false);
  user = { id: "44444444-4444-4444-8444-444444444444" };
  access = false;
  assert.ok((await out.sendLessonQuestion(input)).error);
  assert.equal(touched, false);
  access = true;
  assert.ok(
    (await out.sendLessonQuestion({ ...input, studentId: "55555555-5555-4555-8555-555555555555" }))
      .error
  );
  assert.equal(touched, false);
  exists = false;
  assert.ok((await out.sendLessonQuestion(input)).error);
  exists = true;
  locked = true;
  assert.ok((await out.sendLessonQuestion(input)).error);
  assert.equal(touched, false);
  locked = false;
  assert.ok((await out.sendLessonQuestion({ ...input, body: " " })).error);
  assert.ok((await out.sendLessonQuestion({ ...input, body: "a".repeat(5001) })).error);
  assert.ok((await out.sendLessonQuestion(input)).success);
  assert.equal(written.student_id, user.id);
  assert.equal(written.author_id, user.id);
  staff = true;
  const studentId = "55555555-5555-4555-8555-555555555555";
  assert.ok((await out.sendLessonQuestion({ ...input, studentId })).success);
  assert.equal(written.student_id, studentId);
  assert.equal(written.author_id, user.id);
  dbError = { code: "failure" };
  assert.ok((await out.sendLessonQuestion(input)).error);
  dbError = { code: "23505" };
  assert.ok((await out.sendLessonQuestion(input)).success);
  dbError = null;
  assert.ok((await out.setLessonBookmark({ ...input, saved: true, studentId })).success);
  assert.equal(written.student_id, user.id);
  assert.ok((await out.setLessonBookmark({ ...input, saved: false })).success);
  assert.equal(written.student_id, user.id);
  console.log("13 learning-tools checks passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

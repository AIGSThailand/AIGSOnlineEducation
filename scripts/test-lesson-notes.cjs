const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const source = ts.transpileModule(fs.readFileSync("features/notes/actions.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
let user = null,
  access = true,
  step = true,
  touched = false,
  written;
const row = {
  match(key) {
    assert.equal(key.student_id, "current-user");
    return this;
  },
  maybeSingle: async () => ({ data: { body: "Private note" }, error: null }),
  then(resolve) {
    resolve({ error: null });
  },
};
const db = {
  from(name) {
    assert.equal(name, "lesson_notes");
    touched = true;
    return {
      select: () => row,
      delete: () => row,
      upsert: async (value) => {
        written = value;
        return { error: null };
      },
    };
  },
};
const result = {};
vm.runInNewContext(source, {
  exports: result,
  require(name) {
    if (name === "zod") return require("zod");
    if (name.includes("supabase/server")) return { createClient: async () => db };
    if (name.includes("auth/permissions"))
      return { getCurrentUser: async () => user, canAccessCourse: async () => access };
    if (name.includes("queries")) return { getCoursePlayerData: async () => ({ flatSteps: [] }) };
    return { findStepByContent: () => step };
  },
});
(async () => {
  const input = {
    courseId: "11111111-1111-4111-8111-111111111111",
    lessonId: "22222222-2222-4222-8222-222222222222",
  };
  assert.ok((await result.lessonNoteAction(input, "read")).error);
  assert.equal(touched, false);
  user = { id: "current-user" };
  access = false;
  assert.ok((await result.lessonNoteAction(input, "save")).error);
  assert.equal(touched, false);
  access = true;
  step = false;
  assert.ok((await result.lessonNoteAction(input, "read")).error);
  assert.equal(touched, false);
  step = true;
  assert.ok((await result.lessonNoteAction({ ...input, body: "x".repeat(20001) }, "save")).error);
  assert.equal((await result.lessonNoteAction(input, "read")).body, "Private note");
  await result.lessonNoteAction({ ...input, body: "New note", student_id: "other-user" }, "save");
  assert.equal(written.student_id, "current-user");
  assert.equal(written.body, "New note");
  assert.ok((await result.lessonNoteAction(input, "delete")).success);
  console.log("7 note action checks passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

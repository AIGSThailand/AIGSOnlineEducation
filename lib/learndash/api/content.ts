import { learndashFetch } from "../client";
import type { LearnDashLesson, LearnDashQuiz, LearnDashTopic } from "../types/entities";
import type { LearnDashEntityId } from "../types/common";
import { LearnDashError } from "../errors";

export async function getLearnDashLesson(lessonId: LearnDashEntityId): Promise<LearnDashLesson> {
  const { data } = await learndashFetch<LearnDashLesson>({
    path: `/wp-json/ldlms/v2/sfwd-lessons/${lessonId}`,
  });
  return data;
}

export async function getLearnDashTopic(topicId: LearnDashEntityId): Promise<LearnDashTopic> {
  const { data } = await learndashFetch<LearnDashTopic>({
    path: `/wp-json/ldlms/v2/sfwd-topic/${topicId}`,
  });
  return data;
}

export async function getLearnDashQuiz(quizId: LearnDashEntityId): Promise<LearnDashQuiz> {
  const { data } = await learndashFetch<LearnDashQuiz>({
    path: `/wp-json/ldlms/v2/sfwd-quiz/${quizId}`,
    query: { context: "edit" },
  });
  return data;
}

export async function getLearnDashLessonSafe(
  lessonId: LearnDashEntityId
): Promise<LearnDashLesson | null> {
  try {
    return await getLearnDashLesson(lessonId);
  } catch (err) {
    if (err instanceof LearnDashError && err.code === "LEARNDASH_NOT_FOUND") return null;
    throw err;
  }
}

export async function getLearnDashTopicSafe(topicId: LearnDashEntityId): Promise<LearnDashTopic | null> {
  try {
    return await getLearnDashTopic(topicId);
  } catch (err) {
    if (err instanceof LearnDashError && err.code === "LEARNDASH_NOT_FOUND") return null;
    throw err;
  }
}

export async function getLearnDashQuizSafe(quizId: LearnDashEntityId): Promise<LearnDashQuiz | null> {
  try {
    return await getLearnDashQuiz(quizId);
  } catch (err) {
    if (err instanceof LearnDashError && err.code === "LEARNDASH_NOT_FOUND") return null;
    throw err;
  }
}

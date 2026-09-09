export type CourseEnrollmentAccessRow = {
  enrollmentId: string;
  studentId: string;
  status: string;
  enrollmentSource: string;
  enrolledAt: string;
  expiresAt: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

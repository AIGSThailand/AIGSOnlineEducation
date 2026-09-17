import CourseDetailPage from "@/components/courses/course-detail-page";

export default function Page(props: {
  params: { courseId: string };
  searchParams?: { preview?: string; checkout?: string; session_id?: string };
}) {
  return <CourseDetailPage {...props} />;
}

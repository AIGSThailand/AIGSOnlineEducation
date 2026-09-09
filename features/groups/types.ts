export type GroupListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "archived";
  stripeProductId: string | null;
  stripePriceId: string | null;
  courseCount: number;
  memberCount: number;
  wordpressGroupId: number | null;
  updatedAt: string;
};

export type GroupCourseOption = {
  id: string;
  title: string;
  status: string;
};

export type GroupMemberRow = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  joinedAt: string;
};

export type GroupDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "archived";
  stripeProductId: string | null;
  stripePriceId: string | null;
  wordpressGroupId: number | null;
  courses: GroupCourseOption[];
  members: GroupMemberRow[];
};

export type GroupListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "archived";
  thumbnailUrl: string | null;
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
  thumbnailUrl: string | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  wordpressGroupId: number | null;
  courses: GroupCourseOption[];
  members: GroupMemberRow[];
};

/** Public catalog card for an active group/bundle. */
export type PublicBundleCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  courseCount: number;
  stripePriceId: string | null;
  updatedAt: string;
};

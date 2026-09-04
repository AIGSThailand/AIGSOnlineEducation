import type { LearnDashEntityId } from "./common";
import type { LearnDashWpEntity } from "./common";

export type LearnDashGroup = LearnDashWpEntity & {
  type?: "groups" | string;
};

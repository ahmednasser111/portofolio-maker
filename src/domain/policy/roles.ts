import type { MembershipRole } from "@prisma/client";

export type { MembershipRole };

export type Actor = {
  userId: string;
  workspaceId: string;
  role: MembershipRole;
};

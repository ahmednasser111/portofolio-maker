import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";

// Models with a UUIDv7 `id` primary key (see docs/database-design.md §1).
// `Membership` is deliberately excluded — it uses the natural composite PK
// `(userId, workspaceId)`. Add new model names here as they're introduced
// in later milestones.
const UUID_ID_MODELS = new Set([
  "User",
  "Account",
  "VerificationToken",
  "Workspace",
  "Profile",
  "ProjectCategory",
  "Project",
  "ProjectLink",
  "SkillCategory",
  "Skill",
  "Experience",
  "Education",
  "SocialLink",
  "Theme",
  "NavigationItem",
  "SeoSetting",
  "ContactMessage",
  "ProviderConnection",
  "ImportSession",
  "ImportItem",
  "Asset",
]);

function withUuidV7(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (UUID_ID_MODELS.has(model) && args.data && !("id" in args.data)) {
            args.data = { ...args.data, id: uuidv7() };
          }
          return query(args);
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof withUuidV7> | undefined;
};

export const db = globalForPrisma.prisma ?? withUuidV7(new PrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

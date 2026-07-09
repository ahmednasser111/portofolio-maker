-- HAND-EDITED. Generated via `prisma migrate diff` (non-interactive shadow-db
-- workaround — `prisma migrate dev` refuses to run without a TTY) and then
-- trimmed/extended by hand:
--   1. Removed three redundant CREATE UNIQUE INDEX statements the diff
--      produced for projects.slug / skill_categories.name / skills.name —
--      Prisma's differ doesn't understand the partial (WHERE "deletedAt" IS
--      NULL) indexes already created by the M1 migration, so it proposed
--      plain duplicates that would collide with the existing index names.
--      Those three already exist; nothing to do here.
--   2. Added NULLS NOT DISTINCT to seo_settings' unique index (database-
--      design.md §6 — the single workspace-default row needs this).
--   3. Added the CHECK constraint Prisma has no schema syntax for
--      (isPreset = true ⇒ workspaceId IS NULL, database-design.md §6).
-- If this migration is ever regenerated from schema.prisma, these edits
-- must be re-applied.

-- CreateEnum
CREATE TYPE "NavigationPage" AS ENUM ('HOME', 'ABOUT', 'SKILLS', 'EXPERIENCE', 'EDUCATION', 'CERTIFICATIONS', 'PROJECTS', 'CONTACT', 'RESUME');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "activeThemeId" TEXT;

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "basePresetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_items" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "page" "NavigationPage" NOT NULL,
    "customLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "page" "NavigationPage",
    "title" TEXT,
    "description" TEXT,
    "ogImageUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "themes_workspaceId_idx" ON "themes"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "navigation_items_workspaceId_page_key" ON "navigation_items"("workspaceId", "page");

-- CreateIndex: NULLS NOT DISTINCT so the single workspace-default row
-- (page IS NULL) is also uniqueness-enforced (PG15+).
CREATE UNIQUE INDEX "seo_settings_workspaceId_page_key" ON "seo_settings"("workspaceId", "page") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "contact_messages_workspaceId_createdAt_idx" ON "contact_messages"("workspaceId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_activeThemeId_fkey" FOREIGN KEY ("activeThemeId") REFERENCES "themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_basePresetId_fkey" FOREIGN KEY ("basePresetId") REFERENCES "themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_settings" ADD CONSTRAINT "seo_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: presets are global (workspaceId NULL); workspace-owned
-- themes are never presets.
ALTER TABLE "themes" ADD CONSTRAINT "themes_preset_workspace_check" CHECK (NOT "isPreset" OR "workspaceId" IS NULL);

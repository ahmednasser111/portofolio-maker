-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('AVATAR', 'PROJECT_MEDIA', 'RESUME', 'OG_IMAGE', 'OTHER');

-- AlterTable
ALTER TABLE "import_sessions" ADD COLUMN     "sourceAssetId" TEXT;

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "avatarUrl",
DROP COLUMN "resumeUrl",
ADD COLUMN     "avatarAssetId" TEXT,
ADD COLUMN     "publicResumeAssetId" TEXT;

-- AlterTable
ALTER TABLE "seo_settings" DROP COLUMN "ogImageUrl",
ADD COLUMN     "ogImageAssetId" TEXT;

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_workspaceId_kind_idx" ON "assets"("workspaceId", "kind");

-- NOTE: projects_workspaceId_slug_key / skill_categories_workspaceId_name_key /
-- skills_workspaceId_name_key are deliberately NOT recreated here — `prisma
-- migrate diff` proposed them because it doesn't know about the hand-edited
-- partial unique indexes (WHERE "deletedAt" IS NULL) already created under
-- these exact names in the M1 migration. Recreating them as plain unique
-- indexes would collide with the existing index names.

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_publicResumeAssetId_fkey" FOREIGN KEY ("publicResumeAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_settings" ADD CONSTRAINT "seo_settings_ogImageAssetId_fkey" FOREIGN KEY ("ogImageAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

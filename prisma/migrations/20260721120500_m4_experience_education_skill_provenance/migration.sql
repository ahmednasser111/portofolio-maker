-- AlterTable
ALTER TABLE "educations" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "source" "ContentSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceSnapshot" JSONB;

-- AlterTable
ALTER TABLE "experiences" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "source" "ContentSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceSnapshot" JSONB;

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "source" "ContentSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceSnapshot" JSONB;

-- CreateIndex
CREATE INDEX "educations_workspaceId_source_externalId_idx" ON "educations"("workspaceId", "source", "externalId");

-- CreateIndex
CREATE INDEX "experiences_workspaceId_source_externalId_idx" ON "experiences"("workspaceId", "source", "externalId");

-- CreateIndex
CREATE INDEX "skills_workspaceId_source_externalId_idx" ON "skills"("workspaceId", "source", "externalId");

-- NOTE: projects_workspaceId_slug_key / skill_categories_workspaceId_name_key /
-- skills_workspaceId_name_key are deliberately NOT recreated — see the same
-- note in the previous migration (20260721120000_m4_resume_import). The diff
-- proposes them every time because it doesn't know about the hand-edited
-- partial unique indexes already created under these exact names.

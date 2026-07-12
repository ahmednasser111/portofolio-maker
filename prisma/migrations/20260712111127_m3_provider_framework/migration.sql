-- M3: Provider framework (ProviderConnection, ImportSession, ImportItem).
-- The diff tool proposed re-creating projects_workspaceId_slug_key,
-- skill_categories_workspaceId_name_key and skills_workspaceId_name_key as
-- plain unique indexes — it doesn't know those are hand-edited partial
-- indexes (WHERE "deletedAt" IS NULL) from M1's migration. Stripped; the
-- real ones already exist and would collide on name. See
-- database-design.md's hand-edited-migration convention.

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('GITHUB', 'VERCEL', 'RESUME');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "ImportSessionStatus" AS ENUM ('PENDING', 'PROCESSING', 'REVIEWING', 'COMMITTED', 'DISCARDED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportItemStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED', 'SKIPPED_DUPLICATE', 'COMMITTED');

-- CreateEnum
CREATE TYPE "ImportTargetType" AS ENUM ('PROJECT', 'EXPERIENCE', 'EDUCATION', 'SKILL', 'CERTIFICATION', 'PROFILE_SUMMARY');

-- CreateTable
CREATE TABLE "provider_connections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "ProviderType" NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "accountMeta" JSONB,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "ProviderType" NOT NULL,
    "status" "ImportSessionStatus" NOT NULL DEFAULT 'PENDING',
    "rawPayload" JSONB,
    "payloadSchemaVersion" INTEGER,
    "error" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetType" "ImportTargetType" NOT NULL,
    "data" JSONB NOT NULL,
    "dataSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'PENDING',
    "duplicateOfId" TEXT,
    "createdEntityType" TEXT,
    "createdEntityId" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_connections_workspaceId_provider_key" ON "provider_connections"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "import_sessions_workspaceId_provider_status_idx" ON "import_sessions"("workspaceId", "provider", "status");

-- CreateIndex
CREATE INDEX "import_items_sessionId_idx" ON "import_items"("sessionId");

-- CreateIndex
CREATE INDEX "import_items_workspaceId_targetType_externalId_idx" ON "import_items"("workspaceId", "targetType", "externalId");

-- AddForeignKey
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

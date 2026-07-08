import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import bcrypt from "bcryptjs";
import { z } from "zod";

const seedEnvSchema = z.object({
  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_PASSWORD: z.string().min(8),
  SEED_WORKSPACE_SLUG: z.string().min(1).default("me"),
});

const env = seedEnvSchema.parse({
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
  SEED_WORKSPACE_SLUG: process.env.SEED_WORKSPACE_SLUG,
});

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);

  const workspace = await prisma.workspace.upsert({
    where: { slug: env.SEED_WORKSPACE_SLUG },
    update: {},
    create: {
      id: uuidv7(),
      slug: env.SEED_WORKSPACE_SLUG,
      siteTitle: "My Portfolio",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      id: uuidv7(),
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: "OWNER" },
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: "OWNER",
    },
  });

  console.log(`Seeded workspace "${workspace.slug}" with owner ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

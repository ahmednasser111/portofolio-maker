import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { DEFAULT_THEME_TOKENS, type ThemeTokens } from "../src/features/theme/token-schema";

const OCEAN_PRESET_TOKENS: ThemeTokens = {
  ...DEFAULT_THEME_TOKENS,
  colors: {
    light: {
      ...DEFAULT_THEME_TOKENS.colors.light,
      background: "oklch(0.99 0.01 240)",
      primary: "oklch(0.45 0.15 240)",
      primaryForeground: "oklch(0.98 0 0)",
      accent: "oklch(0.94 0.03 240)",
      accentForeground: "oklch(0.45 0.15 240)",
      border: "oklch(0.9 0.02 240)",
    },
    dark: {
      ...DEFAULT_THEME_TOKENS.colors.dark,
      background: "oklch(0.16 0.02 240)",
      primary: "oklch(0.75 0.12 240)",
      primaryForeground: "oklch(0.16 0.02 240)",
      accent: "oklch(0.24 0.03 240)",
      accentForeground: "oklch(0.85 0.05 240)",
      border: "oklch(0.28 0.02 240)",
    },
  },
};

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

  await prisma.theme.upsert({
    where: { id: "00000000-0000-7000-8000-000000000001" },
    update: { tokens: DEFAULT_THEME_TOKENS },
    create: {
      id: "00000000-0000-7000-8000-000000000001",
      name: "Default",
      tokens: DEFAULT_THEME_TOKENS,
      isPreset: true,
    },
  });

  await prisma.theme.upsert({
    where: { id: "00000000-0000-7000-8000-000000000002" },
    update: { tokens: OCEAN_PRESET_TOKENS },
    create: {
      id: "00000000-0000-7000-8000-000000000002",
      name: "Ocean",
      tokens: OCEAN_PRESET_TOKENS,
      isPreset: true,
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

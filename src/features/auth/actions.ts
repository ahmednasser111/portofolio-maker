"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { signInSchema, type SignInInput } from "./schemas";

type SignInResult = { ok: true } | { ok: false; error: string };

// Not wrapped by createAction (src/lib/create-action.ts) on purpose: that
// wrapper assumes an authenticated actor to run policy checks against, and
// sign-in is the one action that precedes authentication entirely.
export async function signInAction(input: SignInInput): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Invalid email or password." };
    }
    throw error;
  }

  return { ok: true };
}

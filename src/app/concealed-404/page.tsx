import { notFound } from "next/navigation";

// Middleware rewrites unauthenticated /dashboard/** requests here so the
// response is a genuine 404 without disclosing the dashboard's existence.
// Not part of the middleware matcher itself, so no rewrite loop.
export default function ConcealedNotFoundPage() {
  notFound();
}

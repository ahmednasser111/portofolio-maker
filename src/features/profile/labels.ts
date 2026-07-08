import type { availabilityOptions } from "./schemas";

export const availabilityLabels: Record<(typeof availabilityOptions)[number], string> = {
  AVAILABLE: "Available for work",
  UNAVAILABLE: "Not available",
  OPEN_TO_OFFERS: "Open to offers",
};

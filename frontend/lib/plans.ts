export type Plan = "free" | "pro";

export const PLAN_FEATURES = {
  free: {
    chat: true,
    documents: true,
    upload: true,
    translate: false,
    analyze: false,
    compare: false,
    research: false,
  },

  pro: {
    chat: true,
    documents: true,
    upload: true,
    translate: true,
    analyze: true,
    compare: true,
    research: true,
  },
} as const;

export function hasFeature(
  plan: Plan,
  feature: keyof typeof PLAN_FEATURES.free
) {
  return PLAN_FEATURES[plan][feature];
}

export const PLAN_DETAILS = {
  free: {
    name: "Free",
    price: "$0",
    description: "Explore document intelligence.",
  },

  pro: {
    name: "Pro",
    price: "$19.99",
    description: "For serious individual users.",
  },
} as const;
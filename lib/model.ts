import { z } from "zod";
export const stages = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
] as const;
export const candidateInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  role: z.string().trim().min(2).max(100),
  stage: z.enum(stages),
  location: z.string().trim().max(100),
  skills: z.string().trim().max(300),
  experience: z.number().int().min(0).max(60),
  notes: z.string().trim().max(5000),
  source: z.enum([
    "LinkedIn",
    "Referral",
    "Careers page",
    "EarlyJobs",
    "Other",
  ]),
});
export type Candidate = z.infer<typeof candidateInput> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  history: string;
};
export function summarize(items: Candidate[]) {
  const counts = Object.fromEntries(
    stages.map((s) => [s, items.filter((c) => c.stage === s).length]),
  );
  return {
    total: items.length,
    active: items.filter((c) => !["Hired", "Rejected"].includes(c.stage))
      .length,
    interviews: counts.Interview,
    hired: counts.Hired,
    counts,
  };
}
export function filterCandidates(
  items: Candidate[],
  query: string,
  stage: string,
  role: string,
) {
  const q = query.trim().toLowerCase();
  return items.filter(
    (c) =>
      (!q ||
        [c.name, c.email, c.role, c.skills, c.location]
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (!stage || c.stage === stage) &&
      (!role || c.role === role),
  );
}

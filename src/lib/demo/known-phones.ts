import { bucketFor, mockCourierScore, type ScoreBucket } from "@/lib/integrations/fraud/mock";
import type { CourierScore } from "@/lib/integrations/fraud/types";

export interface KnownPhone {
  label: string;
  bucket: ScoreBucket;
  phone: string; // local 11-digit
  score: CourierScore;
  expect: string;
}

/**
 * Reference phone numbers for the demo panel (BUILD_PROMPT_PART3 §20.4).
 * Found deterministically by walking a fixed range until each bucket appears,
 * so they are stable across runs and machines.
 */
function find(bucket: ScoreBucket, start: number): string {
  for (let n = start; n < start + 100_000; n++) {
    const phone = `017${String(n).padStart(8, "0")}`;
    if (bucketFor(phone) === bucket) return phone;
  }
  throw new Error(`no phone found for bucket ${bucket}`);
}

const DEFINITIONS: { label: string; bucket: ScoreBucket; expect: string }[] = [
  { label: "Excellent (trusted)", bucket: "good", expect: "Auto-confirms; COD ceiling raised (-20)" },
  { label: "New customer", bucket: "new", expect: "+10; COD above threshold goes to review" },
  { label: "Mixed history", bucket: "mixed", expect: "+20; likely review queue" },
  { label: "Risky", bucket: "risky", expect: "+40; review queue + advance payment" },
  { label: "Flagged (fraud reports)", bucket: "flagged", expect: "+50; blocked pending manual approval" },
];

export const KNOWN_PHONES: KnownPhone[] = DEFINITIONS.map((k, i) => {
  const phone = find(k.bucket, 11_111_111 + i * 1_000);
  return { ...k, phone, score: mockCourierScore(phone) };
});

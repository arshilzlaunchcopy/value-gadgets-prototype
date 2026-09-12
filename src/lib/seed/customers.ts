import "server-only";

import { randomBytes } from "node:crypto";
import { toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { CTG_AREAS, DHAKA_AREAS, DISTRICT_WEIGHTS, FIRST_NAMES, LANDMARKS, STREET_TEMPLATES, SURNAMES } from "./data/people";
import { Rng, SEED } from "./rng";

export interface SeedCustomer {
  id: string;
  phone: string; // E.164
  full_name: string;
  name_bn: string;
  email: string | null;
  address: {
    recipient_name: string;
    phone: string;
    division: string;
    district: string;
    upazila: string;
    area: string;
    street_address: string;
    landmark: string;
  };
  /** relative order frequency weight */
  weight: number;
  created_at: string;
}

export const CUSTOMER_COUNT = 75;

/** Pure generator - the same 75 people every run. */
export function buildCustomers(count = CUSTOMER_COUNT): Omit<SeedCustomer, "id">[] {
  const rng = new Rng(SEED ^ 0x5eed);
  const used = new Set<string>();
  const out: Omit<SeedCustomer, "id">[] = [];
  const prefixes: [string, number][] = [["017", 45], ["018", 25], ["019", 20], ["013", 5], ["016", 5]];
  const now = Date.now();

  while (out.length < count) {
    const prefix = rng.weighted(prefixes);
    const local = `${prefix}${String(rng.int(10_000_000, 99_999_999))}`;
    if (used.has(local)) continue;
    used.add(local);

    const first = rng.pick(FIRST_NAMES);
    const surnames = SURNAMES.filter((s) => !s.g || s.g === first.g);
    const last = rng.pick(surnames);
    const full_name = `${first.en} ${last.en}`;
    const name_bn = `${first.bn} ${last.bn}`;

    const [division, district] = rng.weighted(DISTRICT_WEIGHTS.map(([d, di, w]) => [[d, di] as [string, string], w] as const));
    const area = district === "Dhaka" ? rng.pick(DHAKA_AREAS) : district === "Chattogram" ? rng.pick(CTG_AREAS) : `${district} Sadar`;
    const upazila = district === "Dhaka" ? area.replace(/ R\/A$/, "") : `${district} Sadar`;
    const street = rng
      .pick(STREET_TEMPLATES)
      .replace("{h}", String(rng.int(1, 120)))
      .replace("{r}", String(rng.int(1, 30)))
      .replace("{f}", `${rng.pick(["A", "B", "C", "D"])}${rng.int(1, 8)}`)
      .replace("{b}", rng.pick(["A", "B", "C", "D", "E", "F"]))
      .replace("{a}", area.split(" ")[0]);

    out.push({
      phone: toE164BD(local)!,
      full_name,
      name_bn,
      email: rng.chance(0.4) ? `${first.en.toLowerCase()}.${last.en.toLowerCase()}${rng.int(1, 99)}@gmail.com` : null,
      address: { recipient_name: full_name, phone: local, division, district, upazila, area, street_address: street, landmark: rng.pick(LANDMARKS) },
      // Zipf-ish: a few heavy buyers, a long tail of one-timers
      weight: rng.chance(0.15) ? rng.int(6, 14) : rng.chance(0.4) ? rng.int(2, 5) : 1,
      created_at: new Date(now - rng.int(5, 150) * 86_400_000).toISOString(),
    });
  }
  return out;
}

/**
 * Idempotent: auth users are looked up by their synthetic email
 * (<local>@PHONE_EMAIL_DOMAIN) and created only when missing. customers and
 * addresses are upserted.
 */
export async function seedCustomers(): Promise<SeedCustomer[]> {
  const admin = createAdminClient();
  const domain = process.env.PHONE_EMAIL_DOMAIN ?? "phone.vgbd.local";
  const people = buildCustomers();

  // existing auth users by email
  const byEmail = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
    page++;
  }

  const result: SeedCustomer[] = [];
  let created = 0;
  for (const p of people) {
    const email = `${p.phone.replace("+88", "")}@${domain}`.toLowerCase();
    let id = byEmail.get(email);
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: randomBytes(24).toString("base64url"),
        user_metadata: { phone: p.phone, full_name: p.full_name, seed: true },
        app_metadata: { seed: true },
      });
      if (error) throw new Error(`createUser ${email}: ${error.message}`);
      id = data.user.id;
      byEmail.set(email, id);
      created++;
    }
    result.push({ id, ...p });
  }

  const { error: cErr } = await admin.from("customers").upsert(
    result.map((c) => ({ id: c.id, phone: c.phone, full_name: c.full_name, email: c.email, created_at: c.created_at })),
    { onConflict: "id" },
  );
  if (cErr) throw new Error(`customers upsert: ${cErr.message}`);

  for (const c of result) {
    const { data: existing } = await admin.from("addresses").select("id").eq("customer_id", c.id).eq("is_default", true).maybeSingle();
    const row = { customer_id: c.id, ...c.address, is_default: true };
    const res = existing ? await admin.from("addresses").update(row).eq("id", existing.id) : await admin.from("addresses").insert(row);
    if (res.error) throw new Error(`addresses: ${res.error.message}`);
  }

  console.log(`[seed] customers: ${result.length} (${created} new auth users)`);
  return result;
}

/** Remove every auth user the seed created (app_metadata.seed = true). */
export async function deleteSeedAuthUsers(): Promise<number> {
  const admin = createAdminClient();
  let removed = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const seeded = data.users.filter((u) => (u.app_metadata as { seed?: boolean })?.seed === true);
    if (seeded.length === 0) break;
    for (const u of seeded) {
      const { error: dErr } = await admin.auth.admin.deleteUser(u.id);
      if (dErr) throw new Error(`deleteUser ${u.id}: ${dErr.message}`);
      removed++;
    }
  }
  return removed;
}

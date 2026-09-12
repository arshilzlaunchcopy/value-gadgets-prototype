import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSettings } from "@/lib/settings";

/**
 * Placeholder policy pages until the `pages` table + editor arrive (Phase 15).
 * Bangla versions are a DBID compliance requirement (PART2 §15.3) and follow then.
 */
const POLICIES: Record<string, { title: string; body: (s: { name: string; days: number }) => string[] }> = {
  terms: {
    title: "Terms & conditions",
    body: (s) => [
      `These terms govern purchases from ${s.name}. By placing an order you confirm the phone number you verified is yours and that the delivery details are accurate.`,
      "Prices are in Bangladeshi taka and include VAT where applicable. Delivery charges are shown at checkout before you confirm.",
      "Cash-on-delivery orders may require phone confirmation before dispatch. Repeated refused deliveries may lead to COD being unavailable for that number.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    body: (s) => [
      `${s.name} collects your phone number, delivery address and order history to fulfil orders and provide support. We do not sell personal data.`,
      "One-time verification codes are sent by SMS and expire within minutes. Payment card details are handled by the payment gateway and never stored by us.",
    ],
  },
  refund: {
    title: "Return & refund policy",
    body: (s) => [
      `Faulty items can be returned or exchanged within ${s.days} days of delivery. Warranty claims after that period are handled through the brand warranty stated on the product page.`,
      "Refunds for prepaid orders are returned to the original payment method within 7 working days of the return being received.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = POLICIES[slug];
  return p ? { title: p.title, alternates: { canonical: `/policies/${slug}` } } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = POLICIES[slug];
  if (!p) notFound();
  const { store, delivery } = await getPublicSettings();
  return (
    <article className="prose prose-neutral max-w-2xl">
      <h1 className="text-2xl font-semibold sm:text-3xl">{p.title}</h1>
      {p.body({ name: store.name, days: delivery.return_days }).map((para, i) => (
        <p key={i} className="text-muted-foreground mt-4 text-sm leading-relaxed">
          {para}
        </p>
      ))}
    </article>
  );
}

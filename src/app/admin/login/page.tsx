import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin") ? sp.next : "/admin";
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <div className="bg-ink flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3 text-white">
          <span className="bg-gradient-brand text-ink grid size-10 place-items-center rounded-lg text-xl font-bold">%</span>
          <span className="text-lg font-semibold">Admin sign in</span>
        </div>
        <LoginForm next={next} initialError={error} />
        <p className="mt-4 text-center text-xs text-white/50">Staff accounts only. Customers sign in with their phone on the store.</p>
      </div>
    </div>
  );
}

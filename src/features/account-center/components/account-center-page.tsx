import { AppShell } from "@/components/shared/app-shell";
import Link from "next/link";

export default function AccountCenterPage() {
  return (
    <AppShell current="accounts">
      <div className="py-6 sm:py-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Pusat akun
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Kelola profil dan akses keluarga Anda.
            </p>
          </div>
        </div>

        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Menu akun
          </p>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <AccountMenuCard
              href="/profile"
              icon="◉"
              title="Profil"
              description="Kelola nama, email, password, dan foto profil."
            />
            <AccountMenuCard
              href="/family"
              icon="♡"
              title="Keluarga"
              description="Buat keluarga, undang anggota, atau gabung dengan kode."
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function AccountMenuCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_16px_rgb(15_23_42/0.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_8px_24px_rgb(15_23_42/0.08)]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
        {icon}
      </span>
      <h2 className="mt-6 text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
        {description}
      </p>
      <span className="mt-auto pt-8 text-sm font-semibold text-blue-600 group-hover:text-blue-700">
        Buka menu <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

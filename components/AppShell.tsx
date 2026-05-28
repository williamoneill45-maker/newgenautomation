"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/new-client", label: "New client" },
  { href: "/clients", label: "Clients" },
  { href: "/billing", label: "Billing" },
  { href: "/invoices", label: "Invoices" },
  { href: "/legal-aid", label: "Legal Aid" },
  { href: "/form-production-rules", label: "Form rules" },
  { href: "/billing-management/form-32b", label: "Billing rules" },
  { href: "/affidavit", label: "Affidavit" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-white text-slate-950 lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">NewGen</p>
            <h1 className="mt-1 text-lg font-semibold tracking-normal text-slate-950">Family Law Automation</h1>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-visible">
            {navItems.map((item) => {
              const active = item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active
                    ? "whitespace-nowrap rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                    : "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden border-t border-slate-200 p-4 text-xs leading-5 text-slate-500 lg:block">
            Client files, billing, Legal Aid, and form generation are being brought into one matter workspace.
          </div>
        </div>
      </aside>
      <div className="min-w-0 bg-slate-50">{children}</div>
    </div>
  );
}

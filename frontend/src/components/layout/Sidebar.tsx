"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useWallet } from "@/contexts/WalletContext";

/**
 * Navigation is split by audience, because the two roles have genuinely
 * different jobs. Members read; the treasurer writes.
 */
const READ_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/about", label: "About" },
];

const WRITE_LINKS = [
  { href: "/income", label: "Record income" },
  { href: "/expense", label: "Record expense" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { status } = useWallet();

  // The write links are shown but disabled-looking when no wallet is
  // connected, rather than hidden. Hiding them makes members think the
  // feature doesn't exist; showing them explains why they can't be used.
  const walletConnected = status === "connected";

  return (
    <nav className="w-full shrink-0 md:w-56" aria-label="Main">
      <SidebarGroup title="Treasury">
        {READ_LINKS.map((link) => (
          <SidebarLink key={link.href} {...link} active={pathname === link.href} />
        ))}
      </SidebarGroup>

      <SidebarGroup title="Treasurer">
        {WRITE_LINKS.map((link) => (
          <SidebarLink
            key={link.href}
            {...link}
            active={pathname === link.href}
            muted={!walletConnected}
          />
        ))}
        {!walletConnected && (
          <p className="px-3 pt-1 text-xs text-foreground-muted">
            Connect a wallet to record transactions.
          </p>
        )}
      </SidebarGroup>
    </nav>
  );
}

function SidebarGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  active,
  muted = false,
}: {
  href: string;
  label: string;
  active: boolean;
  muted?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={[
          "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-brand-subtle text-brand"
            : muted
              ? "text-foreground-muted hover:bg-surface-muted"
              : "hover:bg-surface-muted",
        ].join(" ")}
      >
        {label}
      </Link>
    </li>
  );
}

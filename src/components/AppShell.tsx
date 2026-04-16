import Link from "next/link";

const links = [
  { href: "/agregar-producto", label: "Agregar producto" },
  { href: "/historial", label: "Historial" },
];

type AppShellProps = {
  currentPath: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export function AppShell({ currentPath, children, action }: AppShellProps) {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_right,_#d2e8df,_transparent_42%),radial-gradient(circle_at_bottom_left,_#dce8ff,_transparent_32%)] py-8">
      <div className="app-container space-y-6">
        <header className="panel px-5 py-4 md:px-6">
          <p className="text-center text-2xl font-extrabold tracking-tight text-[var(--foreground)] md:text-3xl">
            Inventario Nexer
          </p>

          {action ? <div className="mt-4">{action}</div> : null}

          <nav className="mt-4 grid grid-cols-2 gap-3">
            {links.map((link) => {
              const active = link.href === currentPath;
              return (
                <Link
                  className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                    active
                      ? "bg-[var(--accent)] text-white"
                      : "bg-white text-[var(--foreground)] ring-1 ring-[var(--border)]"
                  }`}
                  href={link.href}
                  key={link.href}
                >
                  <span className={link.href === "/historial" ? "relative top-[2px]" : ""}>
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

import Nav from "@/components/Nav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <Nav />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</main>
    </div>
  );
}

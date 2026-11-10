import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

// Pathless layout: every back-office page renders inside the sidebar shell.
export const Route = createFileRoute("/_console")({
  component: ConsoleLayout,
});

function ConsoleLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Brain,
  CalendarDays,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  Search,
  Sun,
  ShieldAlert,
  UserRound,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TexMindLogo } from "@/components/brand/logo";
import { useTheme } from "@/lib/theme";
import { adminNav, buyerNav, processNav, type NavGroup } from "@/components/layout/nav-config";
import { clearSession, useSession } from "@/lib/session";
import { STAGE_LABELS } from "@/lib/data";
import { GlobalSearch } from "@/components/layout/global-search";
import { AiAssistant } from "@/components/layout/ai-assistant";
import { VoiceOrbModal } from "@/components/kit/voice-orb-modal";
import { adminNotifications, buyerNotifications } from "@/lib/data";

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="space-y-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group.heading}>
          <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.heading}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const href = item.params ? `/production/${item.params['stage']}` : item.to;
              const active = pathname === href;
              return (
                <li key={item.label + href}>
                  <Link
                    to={item.to}
                    params={item.params as never}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn("size-4 shrink-0", active ? "text-primary" : "opacity-70")}
                    />
                    <span className="truncate">{item.label}</span>
                    {active && <span className="ml-auto h-4 w-1 rounded-full bg-primary" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ProfileFooter({ name, role }: { name: string; role: string }) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent/60">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/12 text-[11px] font-semibold text-primary">
            {name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold">{name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{role}</div>
        </div>
        <Link to="/login" onClick={clearSession} className="ml-auto text-muted-foreground hover:text-foreground">
          <LogOut className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function AccessDenied({ stageLabel, stage }: { stageLabel: string; stage: string }) {
  return (
    <div className="surface mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="size-6" />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Access restricted</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        Your {stageLabel} login can only update {stageLabel.toLowerCase()} work on the orders the factory
        manager assigns to you. Orders, inventory and factory-wide screens are not available.
      </p>
      <Button asChild size="sm" className="mt-5">
        <Link to="/production/$stage" params={{ stage }}>
          Go to {stageLabel} updates
        </Link>
      </Button>
    </div>
  );
}

export function AppShell({
  children,
  variant = "admin",
}: {
  children: ReactNode;
  variant?: "admin" | "buyer";
}) {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [voiceOrbOpen, setVoiceOrbOpen] = useState(false);
  const session = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isProcess = variant === "admin" && session?.role === "process";
  const stageKey = session?.role === "process" ? session.stage : null;
  const groups = isProcess && stageKey
    ? processNav(stageKey, STAGE_LABELS[stageKey])
    : variant === "admin"
      ? adminNav
      : buyerNav;
  const denied =
    isProcess && stageKey
      ? !(pathname === `/production/${stageKey}` || pathname === "/notifications")
      : false;
  const notifications = variant === "admin" ? adminNotifications : buyerNotifications;
  const unread = notifications.filter((n) => !n.read).length;
  const profile =
    session
      ? { name: session.name, role: session.title }
      : variant === "admin"
        ? { name: "Factory Portal", role: "Administrator" }
        : { name: "Buyer Portal", role: "Buyer" };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-[250px]",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {isProcess && stageKey ? (
            <Link to="/production/$stage" params={{ stage: stageKey }}>
              <TexMindLogo compact={collapsed} />
            </Link>
          ) : (
            <Link to={variant === "admin" ? "/dashboard" : "/buyer/dashboard"}>
              <TexMindLogo compact={collapsed} />
            </Link>
          )}

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1 py-4">
              {groups.flatMap((g) => g.items).map((item) => (
                <Link
                  key={item.label + item.to + (item.params?.['stage'] ?? "")}
                  to={item.to}
                  params={item.params as never}
                  title={item.label}
                  className="rounded-lg p-2.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                >
                  <item.icon className="size-4" />
                </Link>
              ))}
              <button
                onClick={() => setCollapsed(false)}
                className="mt-2 rounded-lg p-2.5 text-muted-foreground hover:bg-sidebar-accent"
                aria-label="Expand sidebar"
              >
                <Menu className="size-4" />
              </button>
            </div>
          ) : (
            <NavList groups={groups} />
          )}
        </div>
        {!collapsed && <ProfileFooter {...profile} />}
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[250px]")}>
        {/* Top navbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[272px] overflow-y-auto bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-16 items-center border-b border-sidebar-border px-4">
                <TexMindLogo />
              </div>
              <NavList groups={groups} onNavigate={() => setMobileOpen(false)} />
              <ProfileFooter {...profile} />
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <TexMindLogo compact />
          </div>

          {!isProcess && (
            <div className="relative ml-1 hidden max-w-md flex-1 md:block">
              <GlobalSearch />
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="hidden gap-2 lg:inline-flex">
              <CalendarDays className="size-4" />
              <span className="text-xs font-medium">01 – 08 Sep 2026</span>
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>

            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search">
              <Search className="size-4.5" />
            </Button>

            <Button asChild variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Link to={variant === "admin" ? "/notifications" : "/buyer/notifications"}>
                <Bell className="size-4.5" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            </Button>

            {/* ChatGPT-style Voice Mode Trigger */}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/15 text-primary shadow-xs"
              onClick={() => setVoiceOrbOpen(true)}
              title="Start Live Voice Mode (Like ChatGPT Voice)"
            >
              <Mic className="size-3.5 text-primary animate-pulse" />
              <span className="text-xs font-semibold">Live Voice</span>
            </Button>

            {variant === "admin" && !isProcess && (
              <Button
                size="sm"
                className="hidden gap-1.5 sm:inline-flex"
                onClick={() => setAssistantOpen(true)}
              >
                <Brain className="size-4" />
                <span className="text-xs font-semibold">Ask TexMind</span>
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-0.5 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                      {profile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-[13px] font-semibold">{profile.name}</div>
                  <div className="text-[11px] font-normal text-muted-foreground">{profile.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isProcess && (
                  <DropdownMenuItem asChild>
                    <Link to={variant === "admin" ? "/settings" : "/buyer/profile"}>
                      <UserRound className="size-4" /> Profile
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem asChild>
                  <Link to={variant === "admin" ? "/notifications" : "/buyer/notifications"}>
                    <Bell className="size-4" /> Notifications
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/login" onClick={clearSession}>
                    <LogOut className="size-4" /> Sign out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-5 sm:py-7">
          {denied && stageKey ? (
            <AccessDenied stage={stageKey} stageLabel={STAGE_LABELS[stageKey]} />
          ) : (
            children
          )}
        </main>
      </div>

      {variant === "admin" && !isProcess && (
        <AiAssistant
          open={assistantOpen}
          onOpenChange={setAssistantOpen}
          onOpenVoiceOrb={() => setVoiceOrbOpen(true)}
        />
      )}

      {/* Fullscreen bidirectional Voice Mode (ChatGPT style) */}
      <VoiceOrbModal
        open={voiceOrbOpen}
        onClose={() => setVoiceOrbOpen(false)}
      />
    </div>
  );
}

export { Input };

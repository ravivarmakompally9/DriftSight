import { useLocation } from "react-router-dom";
import { AlertTriangle, LogOut, Menu, Monitor, Moon, Sun } from "lucide-react";

import { AsOfControl } from "@/components/layout/AsOfControl";
import { titleFor } from "@/components/layout/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { useAppStore, type Theme } from "@/store/useAppStore";

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

export function Topbar() {
  const { pathname } = useLocation();
  const item = titleFor(pathname);
  const setNavOpen = useAppStore((s) => s.setNavOpen);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const user = useAppStore((s) => s.user);
  const signOut = useAppStore((s) => s.signOut);
  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setNavOpen(true)}>
        <Menu size={18} />
      </Button>
      <div className="min-w-0">
        <div className="truncate text-xs text-ink-3">MSC ELSA 3 / {item.group}</div>
        <h1 className="truncate text-[20px] font-bold leading-tight">{item.label}</h1>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Hint label="Satellite imagery and ocean fields in this build are generated, not measured.">
          <Badge tone="outline" className="max-md:hidden">
            <AlertTriangle size={12} />
            Prototype · simulated data
          </Badge>
        </Hint>

        <AsOfControl />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Theme: ${theme}`}>
              <ThemeIcon size={17} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            {(["light", "dark", "system"] as Theme[]).map((t) => {
              const Icon = THEME_ICON[t];
              return (
                <DropdownMenuItem key={t} onSelect={() => setTheme(t)} className="capitalize">
                  <Icon size={14} className={theme === t ? "text-brand" : "text-ink-3"} />
                  {t}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft font-display text-[12px] font-bold text-brand"
              aria-label="Account menu"
            >
              {user?.initials ?? "··"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.role === "field" ? "Field team" : "Analyst"}</DropdownMenuLabel>
            <div className="px-2 pb-1.5 text-[13px]">
              <div className="font-semibold">{user?.name}</div>
              <div className="text-ink-3">{user?.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut size={14} className="text-ink-3" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

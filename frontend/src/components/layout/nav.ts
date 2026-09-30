import {
  Database, FileText, Flag, LayoutDashboard, Map, Route, ScanSearch, Waves,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string; label: string; icon: LucideIcon; group: string; counter?: "detections" | "zones" | "missions";
}

export const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Monitor" },
  { to: "/map", label: "Operations map", icon: Map, group: "Monitor", counter: "zones" },
  { to: "/detections", label: "Detections", icon: ScanSearch, group: "Analyse", counter: "detections" },
  { to: "/tracks", label: "Tracks", icon: Route, group: "Analyse" },
  { to: "/forecast", label: "Landfall forecast", icon: Waves, group: "Analyse" },
  { to: "/missions", label: "Missions", icon: Flag, group: "Act", counter: "missions" },
  { to: "/report", label: "Situation report", icon: FileText, group: "Act" },
  { to: "/data", label: "Data & models", icon: Database, group: "System" },
];

export const titleFor = (path: string) =>
  NAV.find((n) => n.to === path) ?? NAV[0];

import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/colors";

const STATUS_TONE = {
  confirmed: "ok", watch: "warn", rejected: "crit", landed: "violet", forecast: "brand",
} as const;

export function StatusPill({ status }: { status: string }) {
  const tone = (STATUS_TONE as Record<string, "ok" | "warn" | "crit" | "violet" | "brand">)[status] ?? "neutral";
  return <Badge tone={tone} dot>{STATUS_LABEL[status] ?? status}</Badge>;
}

const LEVEL_TONE = { HIGH: "crit", MEDIUM: "warn", LOW: "neutral" } as const;

export function LevelPill({ level }: { level: string }) {
  return <Badge tone={(LEVEL_TONE as Record<string, "crit" | "warn" | "neutral">)[level] ?? "neutral"} dot>{level}</Badge>;
}

const MISSION_TONE = { planned: "neutral", in_progress: "warn", completed: "ok" } as const;
const MISSION_LABEL = { planned: "Planned", in_progress: "In progress", completed: "Completed" } as const;

export function MissionPill({ status }: { status: keyof typeof MISSION_TONE }) {
  return <Badge tone={MISSION_TONE[status]} dot>{MISSION_LABEL[status]}</Badge>;
}

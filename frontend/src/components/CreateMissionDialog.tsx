import { useEffect, useState } from "react";

import { LevelPill } from "@/components/Pills";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMission } from "@/hooks/queries";
import { dayLabel } from "@/lib/time";
import type { Zone } from "@/lib/types";
import { latlon, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const TEAMS = [
  "Indian Coast Guard patrol",
  "Kerala Fisheries Dept. boat",
  "District beach clean-up crew",
  "TN Pollution Control Board",
  "NGO volunteer crew",
];

export function CreateMissionDialog({
  zone, open, onOpenChange,
}: { zone: Zone | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const hour = useAppStore((s) => s.hour);
  const create = useCreateMission();
  const [team, setTeam] = useState(TEAMS[0]);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!zone) return;
    setTeam(zone.kind === "sea" ? TEAMS[0] : TEAMS[2]);
    setDate(`${dayLabel(hour + 24)} 2025`);
    setNotes("");
  }, [zone, hour]);

  if (!zone) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { zone, team, planned_date: date, notes, hour },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Create mission</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <LevelPill level={zone.level} />
              <b className="text-ink">{zone.name}</b>
              <span className="font-mono text-[12px] text-ink-3">
                {latlon(zone.lat, zone.lon)} · confidence {pct(zone.confidence)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-1.5">
              <Label htmlFor="m-team">Assigned team</Label>
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger id="m-team"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEAMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="m-date">Planned date</Label>
              <Input id="m-date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="m-notes">Notes for the team</Label>
              <Textarea
                id="m-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={`e.g. launch from ${zone.nearest_harbour}; bring sieves for pellets`}
              />
              <p className="text-xs text-ink-3">{zone.action}</p>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="default" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create mission"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

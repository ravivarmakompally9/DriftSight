import { useNavigate } from "react-router-dom";
import { Map as MapIcon, Route } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/Pills";
import { TrackDetail } from "@/components/TrackDetail";
import { Button } from "@/components/ui/button";
import { Card, CardActions, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useTracks } from "@/hooks/queries";
import { useAppStore } from "@/store/useAppStore";

export default function Tracks() {
  const navigate = useNavigate();
  const hour = useAppStore((s) => s.hour);
  const select = useAppStore((s) => s.select);
  const showTruth = useAppStore((s) => s.layers.truth);
  const { data, isLoading } = useTracks(hour);

  if (isLoading) {
    return <div className="grid gap-4 xl:grid-cols-2">{[0, 1].map((i) => <SkeletonCard key={i} lines={6} />)}</div>;
  }

  if (!data?.length) {
    return (
      <Card>
        <EmptyState
          icon={Route}
          title="No tracked patches yet at this time"
          hint="A track starts the moment the detector flags something. Move the time to 27 May or later."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {data.map((tr) => (
        <Card key={tr.id}>
          <CardHeader>
            <CardTitle className="font-display text-[18px]">{tr.id}</CardTitle>
            <StatusPill status={tr.status} />
            <CardActions>
              <Button size="sm" onClick={() => { select({ type: "track", id: tr.id }); navigate("/map"); }}>
                <MapIcon size={14} />
                Map
              </Button>
            </CardActions>
          </CardHeader>
          <CardBody>
            <TrackDetail track={tr} hour={hour} showTruth={showTruth} />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

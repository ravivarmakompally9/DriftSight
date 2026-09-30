import { useEffect, useRef } from "react";

import type { ChipData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Draws a 24x24 image chip. `rgb` is a true-colour composite of B4/B3/B2 with a
 * gamma stretch; `probability` is the classifier's per-pixel P(debris).
 */
export function ChipCanvas({
  chip, kind, className, alt,
}: { chip: ChipData; kind: "rgb" | "probability"; className?: string; alt: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const n = chip.size * chip.size;
    const img = ctx.createImageData(chip.size, chip.size);
    const stretch = (v: number) => Math.max(0, Math.min(255, Math.pow(Math.max(0, v) / 0.16, 0.7) * 255));

    for (let k = 0; k < n; k++) {
      const o = k * 4;
      if (kind === "rgb") {
        img.data[o] = stretch(chip.bands[2][k]);     // B4 red
        img.data[o + 1] = stretch(chip.bands[1][k]); // B3 green
        img.data[o + 2] = stretch(chip.bands[0][k]); // B2 blue
      } else {
        const p = chip.probability[k];
        img.data[o] = 25 + 225 * p;
        img.data[o + 1] = 40 + 120 * p * (1 - p) * 2 + 30 * p;
        img.data[o + 2] = 90 * (1 - p) + 30;
      }
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [chip, kind]);

  return (
    <canvas
      ref={ref}
      width={chip.size}
      height={chip.size}
      role="img"
      aria-label={alt}
      className={cn("block aspect-square w-full rounded-md border border-line bg-sunken [image-rendering:pixelated]", className)}
    />
  );
}

export function ChipPair({ chip }: { chip: ChipData }) {
  return (
    <div className="grid max-w-[380px] grid-cols-2 gap-2.5">
      <figure className="grid gap-1.5">
        <ChipCanvas chip={chip} kind="rgb" alt="True-colour image chip" />
        <figcaption className="text-[11.5px] text-ink-2">
          True colour (B4 B3 B2) · {chip.extent_m} m × {chip.extent_m} m
        </figcaption>
      </figure>
      <figure className="grid gap-1.5">
        <ChipCanvas chip={chip} kind="probability" alt="AI plastic probability map" />
        <figcaption className="text-[11.5px] text-ink-2">AI plastic probability</figcaption>
      </figure>
    </div>
  );
}

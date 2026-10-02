import { Wifi } from "lucide-react";

export function BrandMark({
  size = 32,
  radius = "rounded-xl",
  glyph = 15,
}: {
  size?: number;
  radius?: string;
  glyph?: number;
}) {
  return (
    <span
      className="tt-logo-mark flex-shrink-0"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Wifi size={glyph} />
    </span>
  );
}

export function BrandWord({ size = "text-[19px]" }: { size?: string }) {
  return (
    <span className={`tt-logo ${size}`}>
      Tech<span className="text-foreground">Talk</span>
    </span>
  );
}

export function Brand({
  size = 32,
  radius = "rounded-xl",
  glyph = 15,
  wordSize,
}: {
  size?: number;
  radius?: string;
  glyph?: number;
  wordSize?: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size} radius={radius} glyph={glyph} />
      <BrandWord size={wordSize ?? (size > 32 ? "text-xl" : "text-[19px]")} />
    </span>
  );
}

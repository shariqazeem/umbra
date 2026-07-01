import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A full-bleed cinematic art layer — the AI-generated dark atmosphere placed behind a
 * section. Kept near-black and low-opacity with a scrim so foreground text stays crisp;
 * the crypto-as-art (PoolScene, proof visuals) remains the signature, this is depth.
 */
export function Atmosphere({
  src,
  className,
  opacity = 0.5,
  align = "center",
  scrim = "vertical",
  priority = false,
  fixed = false,
}: {
  src: string;
  className?: string;
  opacity?: number;
  align?: "top" | "center" | "bottom";
  scrim?: "vertical" | "radial" | "top" | "none";
  priority?: boolean;
  fixed?: boolean;
}) {
  const object =
    align === "top" ? "object-top" : align === "bottom" ? "object-bottom" : "object-center";
  const scrimClass =
    scrim === "vertical"
      ? "bg-gradient-to-b from-background via-background/25 to-background"
      : scrim === "top"
        ? "bg-gradient-to-b from-background via-transparent to-background/60"
        : scrim === "radial"
          ? "bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,transparent_10%,hsl(var(--background))_85%)]"
          : "";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none -z-10 overflow-hidden",
        fixed ? "fixed inset-0" : "absolute inset-0",
        className,
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        priority={priority}
        className={cn("object-cover", object)}
        style={{ opacity }}
      />
      {scrim !== "none" && <div className={cn("absolute inset-0", scrimClass)} />}
    </div>
  );
}

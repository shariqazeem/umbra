import { cn } from "@/lib/utils";
import type { ProductSection } from "@/lib/constants";

/**
 * Placeholder surface for a product capability. Structural black borders, square
 * corners, no shadows. The signal color appears only as a thin marker on
 * cryptographic surfaces, never as decoration.
 */
export function SectionCard({ index, id, title, description, cryptographic }: ProductSection) {
  return (
    <article
      id={id}
      className="group relative flex flex-col border-2 border-foreground bg-background p-6"
    >
      {/* Signal marker — cryptographic surfaces only. */}
      {cryptographic ? (
        <span aria-hidden className="absolute left-0 top-0 h-1 w-full bg-umbra-signal" />
      ) : null}

      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs tracking-widest text-muted-foreground">{index}</span>
        {cryptographic ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-umbra-signal">
            crypto
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            standard
          </span>
        )}
      </div>

      <h3 className={cn("mt-6 text-2xl font-bold uppercase tracking-tight")}>{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

      <div className="mt-6 border-t-2 border-dashed border-border pt-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Phase 0.1 · placeholder
        </span>
      </div>
    </article>
  );
}

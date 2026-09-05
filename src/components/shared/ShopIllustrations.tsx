import * as React from "react";

interface IllustrationProps {
  className?: string;
}

/**
 * A small set of line-art illustrations themed around a kirana / general
 * store, used in place of a plain lucide icon for the "big empty state"
 * moment on a page. Each pairs a soft color-wash backdrop circle (the same
 * translucent low-opacity wash (bg-primary/10 and friends) already used for
 * badges and KPI icon chips
 * elsewhere in the app) with a simple two-tone line drawing of the domain
 * concept — a khata ledger, a stocked shelf, delivery crates — so an empty
 * page still feels like *this* app rather than a generic dashboard.
 *
 * These represent the concept, not literal emptiness (an open ledger, not a
 * missing one) — the same logic most empty-state art follows, since a bare
 * or broken-looking icon reads worse than an inviting, on-theme one.
 */

/** Open ledger / "khata" book — Udhaar (credit ledger) empty state. */
export function KhataBookIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="48" cy="48" r="44" className="fill-warning/10" />
      <path d="M48 34L20 39V74L48 69V34Z" className="fill-card stroke-current" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M48 34L76 39V74L48 69V34Z" className="fill-card stroke-current" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M26 46L42 43M26 53L42 50M26 60L42 57M26 67L42 64" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M54 43L70 46M54 50L70 53M54 57L70 60M54 64L70 67" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M60 24L72 36" className="stroke-warning" strokeWidth="3" strokeLinecap="round" />
      <circle cx="59" cy="23" r="3" className="fill-warning" />
    </svg>
  );
}

/** Stocked shelf — Inventory empty state. */
export function ShelfIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="48" cy="48" r="44" className="fill-primary/10" />
      <line x1="16" y1="42" x2="80" y2="42" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="70" x2="80" y2="70" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="20" y1="42" x2="20" y2="70" className="stroke-current" strokeWidth="2" opacity="0.6" />
      <line x1="76" y1="42" x2="76" y2="70" className="stroke-current" strokeWidth="2" opacity="0.6" />
      <rect x="27" y="24" width="13" height="18" rx="2" className="fill-card stroke-current" strokeWidth="2" />
      <line x1="27" y1="30" x2="40" y2="30" className="stroke-current" strokeWidth="1.5" />
      <rect x="44" y="20" width="15" height="22" rx="1.5" className="fill-card stroke-current" strokeWidth="2" />
      <line x1="44" y1="28" x2="59" y2="28" className="stroke-current" strokeWidth="1.5" opacity="0.6" />
      <path d="M64 21H72V25L75 28V42H61V28L64 25V21Z" className="fill-card stroke-current" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Stacked delivery crates — Purchases empty state. */
export function CrateDeliveryIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="48" cy="48" r="44" className="fill-secondary/10" />
      <rect x="18" y="54" width="60" height="20" rx="2" className="fill-card stroke-current" strokeWidth="2" />
      <path d="M18 64H78M32 54V74M50 54V74M64 54V74" className="stroke-current" strokeWidth="1.5" opacity="0.55" />
      <rect x="29" y="30" width="38" height="20" rx="2" className="fill-card stroke-current" strokeWidth="2" />
      <path d="M29 40H67M41 30V50M55 30V50" className="stroke-current" strokeWidth="1.5" opacity="0.55" />
    </svg>
  );
}

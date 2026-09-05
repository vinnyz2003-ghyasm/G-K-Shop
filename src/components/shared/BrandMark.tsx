import * as React from "react";

/**
 * G&K's brand mark — a small line-art corner-shop storefront (scalloped
 * awning over a shopfront with a door and two display windows), drawn in
 * the same 2px rounded-stroke language as the lucide icons used everywhere
 * else in the app. It inherits color via `currentColor`, so it drops in
 * anywhere a lucide icon would go, e.g. `<BrandMark className="h-4 w-4 text-primary" />`.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* awning frame */}
      <path
        d="M5 12V9C5 8.45 5.45 8 6 8H26C26.55 8 27 8.45 27 9V12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* scalloped awning edge */}
      <path
        d="M5 12Q7.5 16.5 10 12Q13 16.5 16 12Q19 16.5 22 12Q24.5 16.5 27 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* shopfront body */}
      <path
        d="M7 13V26C7 26.55 7.45 27 8 27H24C24.55 27 25 26.55 25 26V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* door */}
      <path
        d="M13.5 27V20.5C13.5 19.12 14.62 18 16 18C17.38 18 18.5 19.12 18.5 20.5V27"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* display windows */}
      <rect x="9.5" y="16" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="19.5" y="16" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

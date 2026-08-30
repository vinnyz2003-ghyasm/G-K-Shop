"use client";

// Reusable camera-barcode-scanning modal, built on html5-qrcode's lower-level
// Html5Qrcode API (not Html5QrcodeScanner) so it renders inside your own
// Dialog instead of the library's own embedded UI/buttons.
//
// Install first: npm install html5-qrcode
//
// Scoped to the formats that actually show up on retail packaging (UPC-A/E,
// EAN-13/8, Code128) rather than every format the library supports (which
// also includes QR, Aztec, PDF417, etc.) — narrower format list means fewer
// false-positive decode attempts per frame.

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, AlertCircle } from "lucide-react";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
}

const SCANNER_ELEMENT_ID = "barcode-scanner-viewport";

const RETAIL_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
];

export function BarcodeScannerDialog({ open, onOpenChange, onScan, title = "Scan Barcode" }: BarcodeScannerDialogProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  // Manual fallback — not in the first draft. A scratched or low-contrast
  // label on real kirana-shop packaging, or a phone whose camera permission
  // is denied, shouldn't leave the person with no way to continue. Hidden by
  // default so the primary flow still reads as "scan → done".
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setStarting(true);
    setShowManualEntry(false);
    setManualCode("");

    // Fresh instance every time the dialog opens — Html5Qrcode instances
    // aren't meant to be reused across stop()/start() cycles reliably.
    //
    // NOTE: `verbose` is a required key on the library's Html5QrcodeFullConfig
    // type (its VALUE type allows undefined, but the KEY itself isn't
    // optional) — omitting it entirely, as the first draft did, does not
    // type-check against the real installed html5-qrcode types. Confirmed
    // directly against node_modules/html5-qrcode's .d.ts before fixing.
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      formatsToSupport: RETAIL_BARCODE_FORMATS,
      verbose: false,
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" }, // rear camera — front-facing makes no sense for scanning packaging
        { fps: 10, qrbox: { width: 260, height: 160 } }, // wide/short box matches 1D barcode proportions
        (decodedText) => {
          // Fires on every successful decode while the camera keeps pointing
          // at the code — guard so onScan only fires once per dialog session.
          if (cancelled) return;
          cancelled = true;
          if (scanner.isScanning) {
            scanner.stop().catch(() => {}).finally(() => scanner.clear());
          }
          onScan(decodedText);
        },
        () => {
          // Per-frame "nothing decoded this frame" callback — fires
          // continuously while aiming, not an error, deliberately ignored.
        }
      )
      .then(() => { if (!cancelled) setStarting(false); })
      .catch((err: any) => {
        if (cancelled) return;
        setStarting(false);
        setShowManualEntry(true);
        setError(
          err?.name === "NotAllowedError" || String(err).includes("Permission")
            ? "Camera access was denied. Allow camera permission for this site in your browser settings, then try again — or type the barcode in below."
            : "Couldn't start the camera — make sure no other app or tab is using it, then try again, or type the barcode in below."
        );
      });

    return () => {
      cancelled = true;
      // Only call stop() if the scanner actually reached a running state.
      // html5-qrcode exposes `isScanning` for exactly this: calling stop()
      // on an instance that never started (e.g. the dialog was closed the
      // instant it opened, or a permission prompt was still pending) throws,
      // and relying on .catch(() => {}) alone to swallow that isn't the same
      // as confirming the camera stream is actually released.
      if (scanner.isScanning) {
        scanner.stop().catch(() => {}).finally(() => scanner.clear());
      } else {
        scanner.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submitManualCode() {
    const code = manualCode.trim();
    if (!code) return;
    onScan(code);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> {title}
          </DialogTitle>
        </DialogHeader>

        {/* BUG FIX: this div used to be conditionally removed from the DOM
            whenever `error` was set, which raced against React's async state
            updates — on a retry after a failed attempt, setError(null) below
            hadn't actually re-rendered the div back into existence yet by
            the time Html5Qrcode's constructor went looking for it, producing
            "Element with id=barcode-scanner-viewport not found". Now the
            div stays permanently mounted whenever the dialog is open, and
            the error message layers on top of it instead of replacing it —
            removing the race entirely rather than trying to out-time it. */}
        <div className="relative">
          <div
            id={SCANNER_ELEMENT_ID}
            className="overflow-hidden rounded-lg border border-border bg-black"
            style={{ minHeight: 220 }}
          />
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-card p-4 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}
        </div>
        {!error && (
          <p className="text-center text-xs text-muted-foreground">
            {starting ? "Starting camera…" : "Point the camera at the barcode"}
          </p>
        )}

        {!error && !showManualEntry && (
          <button
            type="button"
            onClick={() => setShowManualEntry(true)}
            className="text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Barcode won&rsquo;t scan? Type it in instead
          </button>
        )}

        {(showManualEntry || error) && (
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Input
              autoFocus={!!error}
              placeholder="Type the barcode number…"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitManualCode(); }}
              className="flex-1"
            />
            <Button type="button" size="sm" onClick={submitManualCode} disabled={!manualCode.trim()}>
              Use
            </Button>
          </div>
        )}

        {error && (
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

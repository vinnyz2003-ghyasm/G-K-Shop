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

  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");

  // UPDATED FIX: Wrapping scanner initialization in a setTimeout so the Dialog 
  // finishes mounting the DOM element before the camera tries to attach to it.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setStarting(true);
    setShowManualEntry(false);
    setManualCode("");

    let scanner: Html5Qrcode | null = null;

    // 100ms delay gives the Dialog component enough time to mount the DOM elements
    const initTimer = setTimeout(() => {
      if (cancelled) return;

      scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: RETAIL_BARCODE_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            if (cancelled) return;
            cancelled = true;
            if (scanner?.isScanning) {
              scanner.stop().catch(() => {}).finally(() => scanner?.clear());
            }
            onScan(decodedText);
          },
          () => {}
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
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(initTimer); // Cancel the timeout if the dialog closes immediately
      
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {}).finally(() => scanner?.clear());
      } else if (scanner) {
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

        {error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <div
              id={SCANNER_ELEMENT_ID}
              className="overflow-hidden rounded-lg border border-border bg-black"
              style={{ minHeight: 220 }}
            />
            <p className="text-center text-xs text-muted-foreground">
              {starting ? "Starting camera…" : "Point the camera at the barcode"}
            </p>
          </>
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
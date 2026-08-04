"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemLabel?: string;      // e.g. "product", "expense" — defaults to "item"
  isDeleting?: boolean;
  onConfirm: () => void;
}

/**
 * One shared confirmation modal for every destructive delete in the app.
 * Using a single component (rather than one-off `confirm()` calls or
 * duplicated modals per page) is what makes Inventory and Expenses delete
 * flows look and behave identically — same copy, same button order, same
 * warning icon, same loading state while the request is in flight.
 */
export function ConfirmDeleteDialog({
  open, onOpenChange, itemName, itemLabel = "item", isDeleting = false, onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <DialogTitle>Delete this {itemLabel}?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong className="text-foreground">{itemName}</strong>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isDeleting} className="gap-2">
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

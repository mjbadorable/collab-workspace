"use client";

import { useEffect, useRef } from "react";
import ProfileForm from "./profile-form";

// Controlled by the caller (the sidebar, via AppShell). Esc, backdrop click, Cancel and a successful save close it.
export default function EditProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Edit profile"
      className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {/* Mounted only while open, so the fields always start from the saved profile. */}
      {open && (
        <div className="space-y-4 p-5">
          <h2 className="text-base font-semibold">Edit profile</h2>
          <ProfileForm onCancel={onClose} onSaved={onClose} />
        </div>
      )}
    </dialog>
  );
}

"use client";

import { useRef, useState, type FormEvent } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { fileToAvatar } from "@/lib/image-resize";
import { useProfile } from "@/lib/profile-context";
import Avatar from "./avatar";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

// Shared by the Edit Profile dialog and the Settings > Profile tab.
export default function ProfileForm({ onCancel, onSaved }: { onCancel?: () => void; onSaved?: () => void }) {
  const { profile, displayName, email, signedIn, updateProfile } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(displayName);
  const [description, setDescription] = useState(profile.description);
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSuccess(false);
    setProcessing(true);
    try {
      setAvatar(await fileToAvatar(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process that image.");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = ""; // lets the same file be chosen again
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Display name can't be empty.");
    setBusy(true);
    setError(null);
    setNotice(null);
    setSuccess(false);
    const problem = await updateProfile({ name, description, avatar_url: avatar });
    setBusy(false);
    // A cloud failure still saved the change on this device, so it is a notice, not a hard error.
    if (problem) {
      setNotice(problem);
      return;
    }
    setSuccess(true);
    onSaved?.();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar url={avatar} name={name || displayName} className="h-20 w-20 text-xl" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload photo"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={processing}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            {avatar ? "Change photo" : "Upload photo"}
          </button>
          {avatar && (
            <button
              type="button"
              onClick={() => {
                setAvatar(null);
                setSuccess(false);
              }}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Remove photo
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="pf-name" className="mb-1 block text-xs font-medium text-neutral-600">
          Display name
        </label>
        <input
          id="pf-name"
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            setSuccess(false);
          }}
          placeholder="Marvin Jhay"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="pf-email" className="mb-1 block text-xs font-medium text-neutral-600">
          Email
        </label>
        <div className="flex items-center gap-2">
          <input id="pf-email" value={email ?? "Not signed in"} readOnly className={`${fieldClass} bg-neutral-50 text-neutral-500`} />
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
              signedIn ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {signedIn ? "Signed in" : "Local preview"}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="pf-bio" className="mb-1 block text-xs font-medium text-neutral-600">
          Description / Bio
        </label>
        <textarea
          id="pf-bio"
          rows={3}
          maxLength={200}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setSuccess(false);
          }}
          placeholder="Lead Developer & Systems Architect"
          className={fieldClass}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800">
          {notice}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm text-emerald-800">
          Profile updated successfully
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || processing}
          className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

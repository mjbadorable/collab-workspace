"use client";

import { useRef, useState, type FormEvent } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { fileToAvatar } from "@/lib/image-resize";
import { ROLES, roleTone, useProfile, type RoleTitle } from "@/lib/profile-context";
import GymBadgeCase from "@/components/home/gym-badge-case";
import Avatar from "./avatar";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

// Shared by the Edit Profile dialog and the Settings > Profile tab.
const BIO_IDEAS = [
  "Pogi Programmer / Full Stack Developer",
  "Lead Systems Architect & DevOps Engineer",
  "Offline-First PWA Architect & PhilNITS FE Candidate",
  "Full-Stack Trainer · React 19, TypeScript & Vite",
  "Database Gym Leader · PostgreSQL & Dexie Master",
  "Gotta code 'em all — Shipping zero-downtime apps",
  "Cloud Chaser & Clean Code Crafter",
  "Silph DevOps Specialist · CI/CD & Production Monitoring",
  "Frontend Performance Engineer & UI Craftsman",
  "Automating pipelines & squashing bugs one commit at a time",
];

export default function ProfileForm({
  onCancel,
  onSaved,
  showBadges = false,
}: {
  onCancel?: () => void;
  onSaved?: () => void;
  // The Gym Badge Case shows under the form in Settings > Profile, not in the Edit Profile dialog.
  showBadges?: boolean;
}) {
  const { profile, displayName, email, signedIn, updateProfile } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(displayName);
  const [description, setDescription] = useState(profile.description);
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [role, setRole] = useState<RoleTitle>(profile.role);
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
    const problem = await updateProfile({ name, description, avatar_url: avatar, role });
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
    <div className="space-y-6">
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
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="pf-role" className="text-xs font-medium text-neutral-600">
            Pokémon League Title
          </label>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${roleTone(role)}`}>{role}</span>
        </div>
        <select
          id="pf-role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as RoleTitle);
            setSuccess(false);
          }}
          className={fieldClass}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.value}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">Just a badge. It doesn&apos;t change what you can do.</p>
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
        <p className="mt-2 text-xs font-medium text-neutral-500">Quick ideas (click to use)</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {BIO_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => {
                setDescription(idea.slice(0, 200));
                setSuccess(false);
              }}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-left text-xs text-neutral-700 hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              {idea}
            </button>
          ))}
        </div>
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
      {showBadges && <GymBadgeCase />}
    </div>
  );
}

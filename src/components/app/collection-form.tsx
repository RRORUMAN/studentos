"use client";

import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createCollection, deleteCollection, moveToCollection } from "@/server/actions/collections";
import { cn } from "@/lib/utils";

const EMOJI = ["📌", "🍜", "🎟️", "📚", "🌃", "🏋️", "☕", "🎨", "🚆", "🎁"];

/** Create a named collection. Plus and above, enforced on the server. */
export function NewCollectionForm({ canCollaborate }: { canCollaborate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📌");
  const [collaborative, setCollaborative] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20">
        <Plus className="size-4" />
        New collection
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[0.9375rem] font-semibold text-ink-950">New collection</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100">
          <X className="size-4" />
        </button>
      </div>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Date ideas, exam-week cafés, weekend" aria-label="Collection name" className="h-11 w-full rounded-lg bg-paper-2 px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400" />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {EMOJI.map((option) => (
          <button key={option} type="button" onClick={() => setEmoji(option)} aria-pressed={emoji === option} aria-label={`Icon ${option}`} className={cn("grid size-9 place-items-center rounded-full text-lg", emoji === option ? "bg-signal-soft ring-1 ring-signal-deep/40" : "bg-paper-2 hover:bg-ink-100")}>
            {option}
          </button>
        ))}
      </div>
      {canCollaborate ? (
        <label className="mt-3 flex items-center gap-2 text-[0.875rem] text-ink-700">
          <input type="checkbox" checked={collaborative} onChange={(event) => setCollaborative(event.target.checked)} className="size-4 rounded border-ink-300" />
          Let friends add to it
        </label>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}
      <Button
        variant="primary"
        size="md"
        block
        className="mt-3"
        disabled={pending || name.trim().length === 0}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("name", name);
          form.set("emoji", emoji);
          if (collaborative) form.set("collaborative", "on");
          startTransition(async () => {
            const result = await createCollection(form);
            if (result.ok) {
              setOpen(false);
              setName("");
              router.push(`/saved?c=${result.id}`);
              router.refresh();
            } else setError(result.message);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Create
      </Button>
    </div>
  );
}

/** Move a saved item into a collection, or back to the flat list. */
export function CollectionPicker({
  savedId,
  current,
  collections,
}: {
  savedId: string;
  current: string | null;
  collections: readonly { id: string; name: string; emoji: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [, startTransition] = useTransition();

  if (collections.length === 0) return null;

  return (
    <select
      value={value}
      aria-label="Collection"
      onChange={(event) => {
        const next = event.target.value;
        setValue(next);
        startTransition(async () => {
          await moveToCollection(savedId, next || null);
          router.refresh();
        });
      }}
      className="h-8 rounded-full bg-paper-2 px-2.5 text-[0.75rem] font-medium text-ink-700"
    >
      <option value="">No collection</option>
      {collections.map((collection) => (
        <option key={collection.id} value={collection.id}>
          {collection.emoji} {collection.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Delete a named collection. The items in it go back to the flat list; nothing
 * a student saved is ever removed by deleting the folder it sat in.
 */
export function DeleteCollectionButton({ collectionId, name }: { collectionId: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete “${name}”? What is in it stays saved.`)) return;
        startTransition(async () => {
          const result = await deleteCollection(collectionId);
          if (result.ok) {
            toast({ title: `Deleted “${name}”`, description: "Its items are back in All." });
            router.push("/saved");
            router.refresh();
          } else toast({ tone: "warning", title: result.message });
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium text-ink-500 hover:bg-pulse-soft hover:text-pulse-deep"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      Delete collection
    </button>
  );
}

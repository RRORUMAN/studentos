"use client";

import { Check, Loader2, Plus, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/onboarding/controls";
import {
  addBucketEntry,
  addGroupMember,
  createBucket,
  createGroup,
  removeBucketEntry,
  reopenBucket,
  settleBucketUp,
} from "@/server/actions/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * SHARED BUDGETS
 * ----------------------------------------------------------------------------
 * "Saturday night", "Barcelona", "Flat groceries" — a shared envelope with who
 * fronted what, and what everyone owes each other at the end.
 *
 * Explicitly not banking. No money moves through the product; it records who
 * paid and computes the settle-up. Anything more needs a licence, and a
 * student splitting a €14 taxi does not want an onboarding flow with a
 * passport scan in it.
 *
 * The split itself comes from `settleBucket` in the domain layer and the
 * payments from `settleUpTransfers` — the cent-exact ones, so three people
 * splitting €10 always comes to exactly €10 and the bucket can close.
 * ============================================================================
 */

type Where = { currency: string; locale: string };

export type BucketView = {
  id: string;
  name: string;
  emoji: string;
  closed: boolean;
  totalCents: number;
  targetCents: number;
  viewerNetCents: number;
  members: { userId: string; displayName: string; avatarEmoji: string; isViewer: boolean }[];
  entries: { id: string; label: string; amountCents: number; paidByName: string; paidByViewer: boolean }[];
  transfers: { fromName: string; toName: string; amountCents: number; fromViewer: boolean; toViewer: boolean }[];
};

export function SharedBuckets({
  buckets,
  groups,
  friends,
  symbol,
  where,
}: {
  buckets: readonly BucketView[];
  groups: readonly { id: string; name: string; emoji: string; memberCount: number }[];
  /** People this student is friends with — the only people addable to a group. */
  friends: readonly { id: string; name: string }[];
  symbol: string;
  where: Where;
}) {
  const [creating, setCreating] = useState(buckets.length === 0);

  return (
    <div className="space-y-4">
      {/* ---- groups ------------------------------------------------------
          `CreateBucket` below has always offered a group picker, and groups
          could not exist: `groupMembers` was read in six places and written in
          none, so every bucket was `groupId: null` and "shared budgets" — a
          Pro benefit at €9.99 a month promising "split a flat, a trip or a
          night out" — was unreachable. The maths, the contribution rows and
          the settle-up were all built. These two writes were the gap. */}
      <Groups groups={groups} friends={friends} />

      {buckets.map((bucket) => (
        <BucketCard key={bucket.id} bucket={bucket} symbol={symbol} where={where} />
      ))}

      {creating ? (
        <CreateBucket groups={groups} symbol={symbol} onDone={() => setCreating(buckets.length === 0)} />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 hover:bg-ink-100"
        >
          <Plus className="size-3.5" />
          New shared bucket
        </button>
      )}
    </div>
  );
}

/**
 * The groups a student is in, and how to make one.
 *
 * A group is the thing a bucket is shared WITH, so it comes first on the page:
 * a bucket picker offering an empty group list is the state this whole section
 * was stuck in.
 *
 * Adding is friends-only and the server enforces it — a shared bucket shows
 * every member what everybody else paid, so being added to one is not
 * something that should be possible to do to a stranger. When the student has
 * no friends yet the picker says so and links to where friends come from,
 * rather than rendering an empty select.
 */
function Groups({
  groups,
  friends,
}: {
  groups: readonly { id: string; name: string; emoji: string; memberCount: number }[];
  friends: readonly { id: string; name: string }[];
}) {
  const [creating, setCreating] = useState(groups.length === 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <header className="flex items-center justify-between gap-3 border-b border-ink-100 p-5">
        <div>
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">Your groups</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">
            A flat, a trip, a regular night out. A bucket is shared with one of these.
          </p>
        </div>
      </header>

      <div className="space-y-3 p-5">
        {groups.map((group) => (
          <div key={group.id} className="rounded-xl bg-paper-2 p-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-xl">
                {group.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold text-ink-950">{group.name}</span>
                <span className="text-[0.8125rem] text-ink-500">
                  {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                </span>
              </span>
            </div>

            {friends.length > 0 ? (
              <form
                action={(formData) =>
                  startTransition(async () => {
                    setError(null);
                    const result = await addGroupMember(formData);
                    if (!result.ok) setError(result.message);
                  })
                }
                className="mt-3 flex gap-2"
              >
                <input type="hidden" name="groupId" value={group.id} />
                <select
                  name="memberId"
                  aria-label={`Add somebody to ${group.name}`}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-[0.875rem] text-ink-900"
                >
                  {friends.map((friend) => (
                    <option key={friend.id} value={friend.id}>
                      {friend.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending}
                  className="shrink-0 rounded-lg bg-ink-950 px-3.5 text-[0.875rem] font-medium text-paper disabled:opacity-60"
                >
                  Add
                </button>
              </form>
            ) : (
              <p className="mt-3 text-[0.8125rem] text-ink-500">
                You can add people you are friends with.{" "}
                <Link href="/you/friends" className="font-medium text-flow hover:underline">
                  Find people
                </Link>
              </p>
            )}
          </div>
        ))}

        {creating ? (
          <form
            action={(formData) =>
              startTransition(async () => {
                setError(null);
                const result = await createGroup(formData);
                if (result.ok) setCreating(false);
                else setError(result.message);
              })
            }
            className="flex gap-2"
          >
            <input
              name="emoji"
              defaultValue="👥"
              aria-label="Group emoji"
              maxLength={8}
              className="h-10 w-14 rounded-lg border border-ink-200 bg-white px-2 text-center text-[0.9375rem]"
            />
            <input
              name="name"
              required
              maxLength={60}
              placeholder="Flat 4B"
              aria-label="Group name"
              className="h-10 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-[0.875rem] text-ink-900"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-lg bg-ink-950 px-3.5 text-[0.875rem] font-medium text-paper disabled:opacity-60"
            >
              Create
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 hover:bg-ink-100"
          >
            <Plus className="size-3.5" />
            New group
          </button>
        )}

        {error ? <p className="text-[0.8125rem] text-pulse-deep">{error}</p> : null}
      </div>
    </section>
  );
}

function BucketCard({ bucket, symbol, where }: { bucket: BucketView; symbol: string; where: Where }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const fmt = (cents: number) => money(cents / 100, where);

  const position =
    bucket.viewerNetCents === 0
      ? "You are square."
      : bucket.viewerNetCents > 0
        ? `You are owed ${fmt(bucket.viewerNetCents)}.`
        : `You owe ${fmt(-bucket.viewerNetCents)}.`;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <header className="flex items-start gap-3 p-5">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-paper-2 text-xl">
          {bucket.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">{bucket.name}</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">
            {fmt(bucket.totalCents)} between {bucket.members.length}{" "}
            {bucket.members.length === 1 ? "person" : "people"}
            {bucket.closed ? " · settled" : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold",
            bucket.viewerNetCents === 0
              ? "bg-ink-100 text-ink-600"
              : bucket.viewerNetCents > 0
                ? "bg-mint-soft text-mint-deep"
                : "bg-amber-soft text-amber-deep",
          )}
        >
          {position}
        </span>
      </header>

      <ul className="flex flex-wrap gap-2 px-5 pb-4">
        {bucket.members.map((member) => (
          <li
            key={member.userId}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-2.5 py-1 text-[0.8125rem] text-ink-700"
          >
            <span aria-hidden>{member.avatarEmoji}</span>
            {member.isViewer ? "You" : member.displayName}
          </li>
        ))}
      </ul>

      {bucket.entries.length > 0 ? (
        <ul className="divide-y divide-ink-100 border-t border-ink-100">
          {bucket.entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] text-ink-900">{entry.label}</span>
                <span className="block text-[0.8125rem] text-ink-500">
                  {entry.paidByViewer ? "You paid" : `${entry.paidByName} paid`}
                </span>
              </span>
              <span className="tnum shrink-0 font-mono text-[0.9375rem] font-medium text-ink-900">
                {fmt(entry.amountCents)}
              </span>
              {entry.paidByViewer && !bucket.closed ? (
                <button
                  type="button"
                  aria-label={`Remove ${entry.label}`}
                  onClick={() => startTransition(async () => void (await removeBucketEntry(entry.id)))}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 hover:bg-pulse-soft hover:text-pulse-deep"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-ink-100 px-5 py-6 text-center text-[0.875rem] text-ink-600">
          Nothing in it yet. Add what you fronted and everyone else can do the same.
        </p>
      )}

      {bucket.transfers.length > 0 ? (
        <div className="border-t border-ink-100 bg-paper-2/60 px-5 py-4">
          <h3 className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Settle up</h3>
          <ul className="space-y-1.5">
            {bucket.transfers.map((transfer, index) => (
              <li key={index} className="text-[0.875rem] text-ink-800">
                <span className="font-medium">{transfer.fromViewer ? "You" : transfer.fromName}</span>{" "}
                {transfer.fromViewer ? "pay" : "pays"}{" "}
                <span className="font-medium">{transfer.toViewer ? "you" : transfer.toName}</span>{" "}
                <span className="tnum font-mono font-semibold">{fmt(transfer.amountCents)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.8125rem] text-ink-500">
            No money moves here. Pay each other however you normally do, then mark it settled.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-ink-100 p-4">
        {!bucket.closed ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />
              Add what you paid
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={pending || bucket.entries.length === 0}
              onClick={() => startTransition(async () => void (await settleBucketUp(bucket.id)))}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Mark settled
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(async () => void (await reopenBucket(bucket.id)))}
          >
            <Undo2 className="size-3.5" />
            Reopen
          </Button>
        )}
      </div>

      {adding ? <AddEntry bucketId={bucket.id} symbol={symbol} onDone={() => setAdding(false)} /> : null}
    </section>
  );
}

function AddEntry({ bucketId, symbol, onDone }: { bucketId: string; symbol: string; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-t border-ink-100 bg-paper-2/60 p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
        <input
          autoFocus
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Taxi, the big shop, tickets"
          aria-label="What was it"
          className="h-11 rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
        <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white pl-3">
          <span aria-hidden className="font-mono text-ink-400">
            {symbol}
          </span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="0"
            aria-label="Amount"
            className="tnum h-11 w-full bg-transparent pr-3 font-mono text-[0.9375rem] text-ink-900 outline-none"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={pending || !label.trim() || !amount}
          onClick={() => {
            setError(null);
            const form = new FormData();
            form.set("bucketId", bucketId);
            form.set("label", label);
            form.set("amount", amount);
            startTransition(async () => {
              const result = await addBucketEntry(form);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              onDone();
            });
          }}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Add
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CreateBucket({
  groups,
  symbol,
  onDone,
}: {
  groups: readonly { id: string; name: string; emoji: string; memberCount: number }[];
  symbol: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">New shared bucket</h2>
      <p className="mb-4 text-[0.875rem] text-ink-500">
        Attach it to a group and everyone in that group is in the split.
      </p>

      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Saturday night, flat groceries, Barcelona"
        aria-label="Bucket name"
        className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
      />

      {groups.length > 0 ? (
        <fieldset className="mt-3">
          <legend className="mb-1.5 text-sm font-medium text-ink-800">Who is in it?</legend>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setGroupId("")}
              aria-pressed={groupId === ""}
              className={cn(
                "h-9 rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors",
                groupId === "" ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
              )}
            >
              Just me for now
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setGroupId(group.id)}
                aria-pressed={groupId === group.id}
                className={cn(
                  "h-9 rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors",
                  groupId === group.id ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
                )}
              >
                <span aria-hidden className="mr-1">
                  {group.emoji}
                </span>
                {group.name} · {group.memberCount}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mt-3 text-[0.8125rem] text-ink-500">
          You are not in a group yet, so this one starts with just you. Anyone you share a group
          with later joins the split.
        </p>
      )}

      <div className="mt-3">
        <MoneyInput
          label="Rough target (optional)"
          symbol={symbol}
          value={amount}
          onChange={setAmount}
          placeholder="120"
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="md"
        className="mt-4"
        disabled={pending || !name.trim()}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("name", name);
          if (groupId) form.set("groupId", groupId);
          if (amount) form.set("amount", amount);
          startTransition(async () => {
            const result = await createBucket(form);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setName("");
            setAmount("");
            onDone();
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Create bucket
      </Button>
    </section>
  );
}

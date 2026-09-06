import Link from "next/link";

import { BrandMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { brand } from "@/brand/brand.config";
import { cities } from "@/data/cities";

export default function NotFound() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-ink-300/50 dotfield [mask-image:radial-gradient(50%_40%_at_50%_0%,black,transparent)]"
      />
      <div className="page relative flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <BrandMark className="size-8 text-ink-950" />
        <p className="mt-6 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
          404 · nothing here
        </p>
        <h1 className="mt-4 max-w-xl text-display-md text-ink-950">
          This one is not on the map yet.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink-600">
          The page you were after does not exist. The cities below do, and each one has a feed, a
          map and a starter pack.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" variant="primary" size="lg">
            Back to {brand.name}
          </ButtonLink>
          <ButtonLink href="/students" variant="outline" size="lg">
            All cities and campuses
          </ButtonLink>
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-2">
          {cities.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/city/${city.slug}`}
                className="rounded-full border border-ink-200 bg-paper px-3.5 py-2 text-sm text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-950"
              >
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

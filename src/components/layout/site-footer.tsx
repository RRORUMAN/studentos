import { Globe2 } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { brand } from "@/brand/brand.config";
import { footerNav } from "@/config/site";
import { coverageStats } from "@/config/regions";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200 bg-paper-2">
      <div className="page py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_3fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-500">{brand.tagline}</p>

            {/* Reach, stated as the derived numbers rather than as "global". */}
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-paper px-3 py-1.5 text-xs text-ink-600">
              <Globe2 className="size-3.5 text-ink-400" aria-hidden />
              <span className="tnum">
                {coverageStats.cities} cities · {coverageStats.countries} countries ·{" "}
                {coverageStats.currencies} currencies
              </span>
            </p>

            <p className="mt-5 max-w-xs text-[0.8125rem] leading-relaxed text-ink-400">
              Everything shown on this site is sample content, rendered through the real product
              components and marked as sample. City availability is listed honestly, city by city.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footerNav.map((group) => (
              <div key={group.title}>
                <h3 className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                  {group.title}
                </h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-ink-600 underline-offset-4 transition-colors hover:text-ink-950 hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} {brand.legalName}. Built for students moving somewhere new.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/#cities"
              className="text-xs text-ink-500 underline-offset-4 transition-colors hover:text-ink-950 hover:underline"
            >
              Where it works
            </Link>
            <Link
              href="/#ask"
              className="text-xs text-ink-500 underline-offset-4 transition-colors hover:text-ink-950 hover:underline"
            >
              How answers are built
            </Link>
            <Link
              href="/#trust"
              className="text-xs text-ink-500 underline-offset-4 transition-colors hover:text-ink-950 hover:underline"
            >
              Privacy
            </Link>
            <a
              href={`mailto:${brand.contact.support}`}
              className="text-xs text-ink-500 underline-offset-4 transition-colors hover:text-ink-950 hover:underline"
            >
              {brand.contact.support}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

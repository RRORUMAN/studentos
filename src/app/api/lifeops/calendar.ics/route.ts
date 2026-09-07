import { toIcs } from "@/server/engines/lifeops";
import { loadLifeOps } from "@/server/queries/lifeops";
import { requestDate } from "@/server/now";
import { getViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { env } from "@/services/env";

/**
 * The student's own timeline as an .ics file. Signed-in only; nothing here is
 * shareable because a timeline is the most personal object in the product.
 * `?key=` narrows it to one item, which is what "Add to calendar" on a row
 * downloads.
 */
export async function GET(request: Request): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return new Response("Sign in to export your calendar.", { status: 401 });

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const timeline = await loadLifeOps(viewer, requestDate());
  const items = [...timeline.overdue, ...timeline.today, ...timeline.week, ...timeline.upcoming].filter(
    (item) => item.at !== null && (!key || item.key === key),
  );

  const body = toIcs(items, { productName: brand.name, siteUrl: env.siteUrl ?? brand.url });
  const filename = key ? `${brand.slug}-${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics` : `${brand.slug}-lifeops.ics`;

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}

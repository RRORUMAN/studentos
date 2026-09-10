#!/usr/bin/env node
/**
 * ============================================================================
 * A LOCAL OSRM, FOR THE TESTS
 * ----------------------------------------------------------------------------
 * A real HTTP server speaking the real OSRM route protocol, started by the
 * Playwright config and pointed at with `ROUTING_OSRM_URL`.
 *
 * The same argument as `overpass-server.mjs`: the product runs exactly the
 * code it runs in production — builds the URL, makes the request, checks
 * `code`, reads `routes[0].distance` and `.duration`, converts seconds to
 * minutes — and the only thing that changed is which host answers. A break in
 * the URL construction, the response parsing or the failover still fails the
 * suite. A mock inside the application would exercise none of it.
 *
 * WHY IT MATTERS HERE. Until this existed, nothing in the suite had ever run
 * the routing chain at all: `withRoutedProximity` had no caller, so the
 * providers, the cache and the straight-line fallback were all dead code that
 * `/admin` and four documents described as a working capability.
 *
 * WHAT IT RETURNS. A fixed 1,340 m / 17-minute walk, whatever the coordinates.
 * Deliberately a figure no straight line between two Madrid places would
 * produce by coincidence, so a test asserting "17 min walk" is asserting that
 * the ROUTE was used and not the fallback.
 *
 * It answers every path, because the point is the shape of the reply rather
 * than the routing.
 * ============================================================================
 */

import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 3313);

/** Metres and seconds, as OSRM reports them. 1020s is 17 minutes exactly. */
const ROUTE = { distance: 1340, duration: 1020 };

createServer((request, response) => {
  if (!request.url?.includes("/route/v1/")) {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ code: "NoRoute" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ code: "Ok", routes: [ROUTE] }));
}).listen(PORT, () => {
  process.stdout.write(`osrm stub listening on ${PORT}\n`);
});

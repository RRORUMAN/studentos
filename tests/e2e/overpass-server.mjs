#!/usr/bin/env node
/**
 * ============================================================================
 * A LOCAL OVERPASS, FOR THE TESTS
 * ----------------------------------------------------------------------------
 * A real HTTP server speaking the real Overpass protocol, started by the
 * Playwright config and pointed at with `OVERPASS_URL`.
 *
 * WHY THIS RATHER THAN A MOCK. The first e2e run against the real API made
 * several hundred requests to a volunteer-run service and timed out on most of
 * them: every page that shows a place, on two browser profiles, for a suite
 * that runs on every push. That is both unkind and useless — a suite whose
 * results depend on somebody else's load is a suite nobody trusts.
 *
 * The alternative usually taken is to stub the provider inside the
 * application, which puts a test-only branch into shipped code and means the
 * adapter itself is never exercised. This does the opposite: the product runs
 * exactly the code it runs in production, makes a real HTTP request, parses a
 * real Overpass JSON body, and the only thing that changed is which host
 * answers. A break in the query builder, the content-type check, the element
 * parser or the failover still fails the suite.
 *
 * WHAT IT RETURNS. Real objects, copied from what the public API returned for
 * these coordinates, with their true ids so the source links resolve. The
 * bounding filter is deliberately crude — this is not an Overpass
 * implementation, it is enough of one to answer the queries the product makes.
 *
 *   node tests/e2e/overpass-server.mjs [port]
 * ============================================================================
 */

import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 3312);

/**
 * A small, real slice of OpenStreetMap.
 *
 * Every id, name, coordinate and tag below came back from the public Overpass
 * API. They are kept verbatim so that a card rendered in a test looks like a
 * card rendered in production, down to the source link.
 */
const ELEMENTS = [
  /* --- Madrid ----------------------------------------------------------- */
  {
    type: "node",
    id: 26472667,
    lat: 40.4117047,
    lon: -3.7079389,
    tags: {
      name: "Farmacia la Latina",
      amenity: "pharmacy",
      phone: "+34 913652850",
      "addr:street": "Calle de Toledo",
      "addr:housenumber": "53",
      "addr:postcode": "28005",
    },
  },
  {
    type: "node",
    id: 624783119,
    lat: 40.4203315,
    lon: -3.6980193,
    tags: {
      name: "Dia",
      brand: "Dia",
      operator: "Dia",
      shop: "supermarket",
      opening_hours: "Mo-Sa 09:15-21:30",
    },
  },
  {
    type: "node",
    id: 1799034285,
    lat: 40.4155,
    lon: -3.7074,
    tags: { name: "Mercadona", brand: "Mercadona", shop: "supermarket", opening_hours: "Mo-Sa 09:00-21:30" },
  },
  {
    type: "node",
    id: 4275009391,
    lat: 40.4192,
    lon: -3.7015,
    tags: { name: "Biblioteca Pública Pedro Salinas", amenity: "library" },
  },
  {
    type: "node",
    id: 2196628619,
    lat: 40.4139,
    lon: -3.7024,
    tags: { name: "Casa Toni", amenity: "restaurant", cuisine: "spanish" },
  },
  {
    type: "node",
    id: 3121178931,
    lat: 40.4171,
    lon: -3.7051,
    tags: { name: "El Brillante", amenity: "fast_food", cuisine: "sandwich" },
  },
  {
    type: "way",
    id: 24906959,
    center: { lat: 40.4152, lon: -3.6844 },
    tags: { name: "Parque del Retiro", leisure: "park" },
  },
  /* --- Berlin ----------------------------------------------------------- */
  {
    type: "node",
    id: 2411251183,
    lat: 40.4188,
    lon: -3.7009,
    tags: { name: "Gimnasio Metropolitan", leisure: "fitness_centre" },
  },
  {
    type: "node",
    id: 300582867,
    lat: 52.5192,
    lon: 13.3868,
    tags: {
      name: "Dorotheenstadt Apotheke",
      amenity: "pharmacy",
      opening_hours: "Mo-Fr 08:00-19:00",
    },
  },
  {
    type: "node",
    id: 1287400987,
    lat: 52.5148,
    lon: 13.3903,
    tags: { name: "REWE", brand: "REWE", shop: "supermarket", opening_hours: "Mo-Sa 07:00-22:00" },
  },
  {
    type: "node",
    id: 4076285821,
    lat: 52.5203,
    lon: 13.3915,
    tags: { name: "Staatsbibliothek zu Berlin", amenity: "library" },
  },
  /* --- Barcelona -------------------------------------------------------- */
  {
    type: "node",
    id: 1493928182,
    lat: 41.3833,
    lon: 2.1799,
    tags: { name: "Condis", shop: "supermarket", opening_hours: "Mo-Sa 09:00-21:00" },
  },
  {
    type: "node",
    id: 2632900891,
    lat: 41.3841,
    lon: 2.1751,
    tags: { name: "Farmàcia Gran Via", amenity: "pharmacy" },
  },
  /* --- London ----------------------------------------------------------- */
  {
    type: "node",
    id: 1043391817,
    lat: 51.5091,
    lon: -0.1284,
    tags: { name: "Tesco Express", brand: "Tesco", shop: "supermarket" },
  },
  /* --- Amsterdam -------------------------------------------------------- */
  {
    type: "node",
    id: 2439121993,
    lat: 52.3676,
    lon: 4.8846,
    tags: { name: "Albert Heijn", brand: "Albert Heijn", shop: "supermarket" },
  },
];

/** `around:1500,40.4168,-3.7038` out of the query the product actually sent. */
function parseAround(query) {
  const match = /around:(\d+),(-?[\d.]+),(-?[\d.]+)/.exec(query);
  if (!match) return null;
  return { radius: Number(match[1]), lat: Number(match[2]), lng: Number(match[3]) };
}

/** `nwr["shop"="supermarket"]` -> the set of key=value pairs asked for. */
function parseSelectors(query) {
  const selectors = new Set();
  for (const match of query.matchAll(/\["([a-z_:]+)"="([a-z_:]+)"\]/g)) {
    selectors.add(`${match[1]}=${match[2]}`);
  }
  return selectors;
}

/** `node(id:1,2)` and friends, for a lookup rather than a search. */
function parseIds(query) {
  const ids = new Set();
  for (const match of query.matchAll(/(node|way|relation)\(id:([\d,]+)\)/g)) {
    for (const id of match[2].split(",")) ids.add(`${match[1]}/${id}`);
  }
  return ids;
}

const EARTH = 6_371_008.8;
const toRad = (degrees) => (degrees * Math.PI) / 180;

function metresBetween(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });

  request.on("end", () => {
    const query = decodeURIComponent((body.split("data=")[1] ?? "").replace(/\+/g, " "));

    const ids = parseIds(query);
    const around = parseAround(query);
    const selectors = parseSelectors(query);

    let elements;

    if (ids.size > 0) {
      elements = ELEMENTS.filter((element) => ids.has(`${element.type}/${element.id}`));
    } else if (around) {
      elements = ELEMENTS.filter((element) => {
        const point = {
          lat: element.lat ?? element.center?.lat,
          lng: element.lon ?? element.center?.lon,
        };
        /* Generous on the radius: this stands in for a spatial index, and a
           test asserting "something came back" must not fail on rounding. */
        if (metresBetween(around, point) > around.radius * 1.5) return false;
        return [...selectors].some((selector) => {
          const [key, value] = selector.split("=");
          return element.tags[key] === value;
        });
      });
    } else {
      elements = [];
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        version: 0.6,
        generator: "StudentOS e2e fixture",
        osm3s: {
          timestamp_osm_base: new Date().toISOString(),
          copyright: "The data included in this document is from www.openstreetmap.org.",
        },
        elements,
      }),
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`overpass fixture listening on http://127.0.0.1:${PORT}/api/interpreter`);
});

/**
 * ============================================================================
 * CITY GEOGRAPHY
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-cities.mjs
 *
 * Source      Wikidata, via https://query.wikidata.org/sparql
 * Properties  P625 coordinate location, P1082 population, P17 country
 * Fetched     2026-09-09
 * Rows        80
 *
 * `wikidataId` is the provenance for every figure in the row:
 * https://www.wikidata.org/wiki/<id>
 *
 * The coordinate is the city's own point — its centre as Wikidata records it,
 * not a campus and not a downtown that somebody chose. Place search uses it as
 * the origin of a radius, so it only has to be right to within a district.
 *
 * `population` is the municipality. It is shown as a city fact and is never
 * used to imply how many students are on StudentOS.
 * ============================================================================
 */

export type CityGeo = {
  key: string;
  /** https://www.wikidata.org/wiki/<id> */
  wikidataId: string;
  lat: number;
  lng: number;
  /** Municipality population where Wikidata states one. */
  population: number | null;
};

export const CITY_GEO_FETCHED_ON = "2026-09-09";

export const cityGeo: readonly CityGeo[] = [
  { key: "abu-dhabi", wikidataId: "Q1519", lat: 24.45111, lng: 54.39694, population: 1570000 },
  { key: "accra", wikidataId: "Q3761", lat: 5.55602, lng: -0.1969, population: 1782150 },
  { key: "amsterdam", wikidataId: "Q727", lat: 52.36667, lng: 4.88333, population: 921468 },
  { key: "athens", wikidataId: "Q1524", lat: 37.98417, lng: 23.72806, population: 643452 },
  { key: "auckland", wikidataId: "Q37100", lat: -36.84917, lng: 174.76528, population: 1470100 },
  { key: "austin", wikidataId: "Q16559", lat: 30.3, lng: -97.73333, population: 961855 },
  { key: "bangkok", wikidataId: "Q1861", lat: 13.75, lng: 100.51667, population: 5676648 },
  { key: "barcelona", wikidataId: "Q1492", lat: 41.3825, lng: 2.17694, population: 1731649 },
  { key: "bengaluru", wikidataId: "Q1355", lat: 12.97912, lng: 77.5913, population: 12327000 },
  { key: "berlin", wikidataId: "Q64", lat: 52.51667, lng: 13.38333, population: 3782202 },
  { key: "bilbao", wikidataId: "Q8692", lat: 43.26306, lng: -2.935, population: 351124 },
  { key: "bogota", wikidataId: "Q2841", lat: 4.60971, lng: -74.08175, population: 8034649 },
  { key: "bologna", wikidataId: "Q1891", lat: 44.49389, lng: 11.34278, population: 387971 },
  { key: "boston", wikidataId: "Q100", lat: 42.36028, lng: -71.05778, population: 675647 },
  { key: "brussels", wikidataId: "Q239", lat: 50.84667, lng: 4.35167, population: 195546 },
  { key: "budapest", wikidataId: "Q1781", lat: 47.49833, lng: 19.04083, population: 1685209 },
  { key: "buenos-aires", wikidataId: "Q1486", lat: -34.59972, lng: -58.38194, population: 3121707 },
  { key: "cairo", wikidataId: "Q85", lat: 30.04444, lng: 31.23583, population: 9801536 },
  { key: "cape-town", wikidataId: "Q5465", lat: -33.92528, lng: 18.42389, population: 3776313 },
  { key: "casablanca", wikidataId: "Q7903", lat: 33.59917, lng: -7.62, population: 3215935 },
  { key: "chicago", wikidataId: "Q1297", lat: 41.88194, lng: -87.62778, population: 2746388 },
  { key: "cologne", wikidataId: "Q365", lat: 50.94222, lng: 6.95778, population: 1024621 },
  { key: "copenhagen", wikidataId: "Q1748", lat: 55.67611, lng: 12.56889, population: 667099 },
  { key: "delhi", wikidataId: "Q987", lat: 28.61389, lng: 77.20889, population: 249998 },
  { key: "doha", wikidataId: "Q3861", lat: 25.28611, lng: 51.52944, population: 1186023 },
  { key: "dubai", wikidataId: "Q612", lat: 25.26972, lng: 55.30944, population: 3944751 },
  { key: "dublin", wikidataId: "Q1761", lat: 53.34972, lng: -6.26028, population: 592713 },
  { key: "edinburgh", wikidataId: "Q23436", lat: 55.95333, lng: -3.18917, population: 488050 },
  { key: "florence", wikidataId: "Q2044", lat: 43.77139, lng: 11.25417, population: 360930 },
  { key: "frankfurt", wikidataId: "Q1794", lat: 50.11056, lng: 8.68222, population: 775790 },
  { key: "granada", wikidataId: "Q8810", lat: 37.175, lng: -3.6, population: 233975 },
  { key: "hamburg", wikidataId: "Q1055", lat: 53.55, lng: 10, population: 1910160 },
  { key: "helsinki", wikidataId: "Q1757", lat: 60.17083, lng: 24.9375, population: 694392 },
  { key: "hong-kong", wikidataId: "Q8646", lat: 22.27833, lng: 114.15861, population: 7413070 },
  { key: "istanbul", wikidataId: "Q406", lat: 41.01, lng: 28.96028, population: 15655924 },
  { key: "johannesburg", wikidataId: "Q34647", lat: -26.20436, lng: 28.04164, population: 4803262 },
  { key: "krakow", wikidataId: "Q31487", lat: 50.06139, lng: 19.93722, population: 804237 },
  { key: "kuala-lumpur", wikidataId: "Q1865", lat: 3.14778, lng: 101.69528, population: 9000280 },
  { key: "lagos", wikidataId: "Q8673", lat: 6.45611, lng: 3.39361, population: 15070000 },
  { key: "lisbon", wikidataId: "Q597", lat: 38.70804, lng: -9.13902, population: 545796 },
  { key: "london", wikidataId: "Q84", lat: 51.50722, lng: -0.1275, population: 8799728 },
  { key: "los-angeles", wikidataId: "Q65", lat: 34.05223, lng: -118.24368, population: 3898747 },
  { key: "lyon", wikidataId: "Q456", lat: 45.7675, lng: 4.835, population: 519127 },
  { key: "madrid", wikidataId: "Q2807", lat: 40.41694, lng: -3.70333, population: 3506730 },
  { key: "malaga", wikidataId: "Q8851", lat: 36.71667, lng: -4.41667, population: 599063 },
  { key: "manchester", wikidataId: "Q18125", lat: 53.47944, lng: -2.24528, population: 547627 },
  { key: "melbourne", wikidataId: "Q3141", lat: -37.81417, lng: 144.96306, population: 5350705 },
  { key: "mexico-city", wikidataId: "Q1489", lat: 19.35377, lng: -99.13589, population: 9209944 },
  { key: "milan", wikidataId: "Q490", lat: 45.46694, lng: 9.19, population: 1354196 },
  { key: "montreal", wikidataId: "Q340", lat: 45.50334, lng: -73.58684, population: 1895211 },
  { key: "munich", wikidataId: "Q1726", lat: 48.1375, lng: 11.575, population: 1510378 },
  { key: "nairobi", wikidataId: "Q3870", lat: -1.28639, lng: 36.81722, population: 5545000 },
  { key: "new-york", wikidataId: "Q60", lat: 40.71278, lng: -74.00611, population: 8804190 },
  { key: "oslo", wikidataId: "Q585", lat: 59.91333, lng: 10.73889, population: 717710 },
  { key: "paris", wikidataId: "Q90", lat: 48.85667, lng: 2.35222, population: 2103778 },
  { key: "porto", wikidataId: "Q36433", lat: 41.15, lng: -8.61083, population: 231800 },
  { key: "prague", wikidataId: "Q1085", lat: 50.0875, lng: 14.42139, population: 1397880 },
  { key: "rome", wikidataId: "Q220", lat: 41.89306, lng: 12.48278, population: 2748109 },
  { key: "rotterdam", wikidataId: "Q34370", lat: 51.92, lng: 4.48, population: 664311 },
  { key: "salamanca", wikidataId: "Q15695", lat: 40.965, lng: -5.66417, population: 146110 },
  { key: "santiago", wikidataId: "Q2887", lat: -33.4375, lng: -70.65, population: 6257516 },
  { key: "sao-paulo", wikidataId: "Q174", lat: -23.55039, lng: -46.63395, population: 11451999 },
  { key: "seoul", wikidataId: "Q8684", lat: 37.56, lng: 126.99, population: 9668465 },
  { key: "seville", wikidataId: "Q8717", lat: 37.38861, lng: -5.995, population: 689423 },
  { key: "singapore", wikidataId: "Q334", lat: 1.3, lng: 103.8, population: 5866139 },
  { key: "stockholm", wikidataId: "Q1754", lat: 59.32944, lng: 18.06861, population: 984748 },
  { key: "sydney", wikidataId: "Q3130", lat: -33.86778, lng: 151.21, population: 5450496 },
  { key: "zurich", wikidataId: "Q72", lat: 47.37444, lng: 8.54111, population: 452421 },
  { key: "taipei", wikidataId: "Q1867", lat: 25.0375, lng: 121.5625, population: 2442991 },
  { key: "tallinn", wikidataId: "Q1770", lat: 59.43722, lng: 24.745, population: 457572 },
  { key: "tel-aviv", wikidataId: "Q33935", lat: 32.08, lng: 34.78, population: 467875 },
  { key: "tokyo", wikidataId: "Q1490", lat: 35.68944, lng: 139.69167, population: 14264798 },
  { key: "toronto", wikidataId: "Q172", lat: 43.67028, lng: -79.38667, population: 2794356 },
  { key: "toulouse", wikidataId: "Q7880", lat: 43.60444, lng: 1.44333, population: 514819 },
  { key: "turin", wikidataId: "Q495", lat: 45.07917, lng: 7.67611, population: 841600 },
  { key: "utrecht", wikidataId: "Q803", lat: 52.09083, lng: 5.12167, population: 359370 },
  { key: "valencia", wikidataId: "Q8818", lat: 39.47, lng: -0.37639, population: 840792 },
  { key: "vancouver", wikidataId: "Q24639", lat: 49.26083, lng: -123.11389, population: 662248 },
  { key: "vienna", wikidataId: "Q1741", lat: 48.20833, lng: 16.3725, population: 2028289 },
  { key: "warsaw", wikidataId: "Q270", lat: 52.23, lng: 21.01111, population: 1862402 },
];

#!/usr/bin/env node
/**
 * Regenerates the mascot asset manifest from what is actually on disk.
 *
 *   pnpm mascot:manifest
 *
 * Looks in public/brand/mascot for <state>.webp / .avif / .png, reads each
 * file's pixel size, and rewrites the `mascotAssets` object in
 * src/brand/mascot.config.ts. Nothing is declared that does not exist, so the
 * UI can never point at a missing render.
 *
 * Accepted states are read from the config itself, so adding a state there is
 * enough for its render to be picked up here.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dir = join(root, "public", "brand", "mascot");
const configPath = join(root, "src", "brand", "mascot.config.ts");

const config = readFileSync(configPath, "utf8");
const statesMatch = config.match(/export const mascotStates = \[([\s\S]*?)\] as const;/);
if (!statesMatch) throw new Error("Could not find mascotStates in mascot.config.ts");
const states = [...statesMatch[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);

/** Minimal dimension readers. WebP (VP8/VP8L/VP8X), PNG, AVIF (ispe box). */
function dimensions(buffer) {
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (chunk === "VP8L") {
      const b = buffer.readUInt32LE(21);
      return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
    if (chunk === "VP8 ") {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
  }
  if (buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  const ispe = buffer.indexOf("ispe");
  if (ispe !== -1) {
    return { width: buffer.readUInt32BE(ispe + 8), height: buffer.readUInt32BE(ispe + 12) };
  }
  return null;
}

let files = [];
try {
  files = readdirSync(dir);
} catch {
  files = [];
}

const manifest = {};
for (const state of states) {
  const file = ["webp", "avif", "png"].map((ext) => `${state}.${ext}`).find((name) => files.includes(name));
  if (!file) continue;
  const path = join(dir, file);
  if (!statSync(path).isFile()) continue;
  const size = dimensions(readFileSync(path));
  if (!size || size.width < 256) {
    console.warn(`Skipping ${file}: could not read a size of at least 256px.`);
    continue;
  }
  manifest[state] = { file, width: size.width, height: size.height };
}

const body =
  Object.keys(manifest).length === 0
    ? "export const mascotAssets: MascotAssetManifest = {};"
    : `export const mascotAssets: MascotAssetManifest = ${JSON.stringify(manifest, null, 2)};`;

const next = config.replace(/export const mascotAssets: MascotAssetManifest = [\s\S]*?;\n/, `${body}\n`);
writeFileSync(configPath, next);

console.log(
  Object.keys(manifest).length === 0
    ? "No renders found in public/brand/mascot. Vector character stays canonical."
    : `Manifest updated: ${Object.keys(manifest).join(", ")}`,
);

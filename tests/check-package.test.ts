import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error The packaging helpers are plain ESM without declarations.
import { inspectPackage } from "../scripts/check-package.mjs";
// @ts-expect-error The packaging helpers are plain ESM without declarations.
import { publishedManifest } from "../scripts/pack-manifest.mjs";

const read = (name: string) => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
const sourceManifest = JSON.parse(read("paseo-plugin.json"));
const files = [
  "package.json", "paseo-plugin.json", "OVERVIEW.md", "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md",
  "index.client.tsx", "index.server.ts", "server/launcher-artifact.ts", "shared/contracts.ts", "client/runtime.ts",
];
const inspect = (overrides: Record<string, unknown>) => inspectPackage({ files, manifest: publishedManifest(sourceManifest), overview: read("OVERVIEW.md"), sourceManifest, ...overrides });

describe("packed tarball", () => {
  it("accepts the repository's own manifest and overview", () => {
    expect(inspect({})).toEqual([]);
  });

  it("names missing files and development files that leaked in", () => {
    expect(inspect({ files: [...files.filter((file) => file !== "OVERVIEW.md"), "tests/setup.ts", "paseo-plugin.json.git"] }))
      .toEqual(["missing OVERVIEW.md", "unexpected tests/setup.ts", "unexpected paseo-plugin.json.git"]);
  });

  it("rejects a manifest that still carries the Git-only build commands", () => {
    expect(inspect({ manifest: sourceManifest })).toEqual(["paseo-plugin.json differs from the source manifest without its build commands"]);
  });

  it("rejects an overview with an install command, which the plugin directory refuses", () => {
    expect(inspect({ overview: "Run `paseo plugin add dutchakdev/account-switcher`." })).toEqual(["OVERVIEW.md contains an install command"]);
    expect(inspect({ overview: "Then npm i the CLI." })).toEqual(["OVERVIEW.md contains an install command"]);
  });
});

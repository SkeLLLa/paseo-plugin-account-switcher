import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error The packaging helpers are plain ESM without declarations.
import { inspectShrinkwrap, productionShrinkwrap } from "../scripts/shrinkwrap.mjs";
// @ts-expect-error The packaging helpers are plain ESM without declarations.
import { inspectPackage } from "../scripts/check-package.mjs";

const read = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8"));
const lock = read("package-lock.json");
const packageJson = read("package.json");
type Entry = { version: string; resolved: string; integrity: string; dev?: boolean };

describe("published shrinkwrap", () => {
  const shrinkwrap = productionShrinkwrap(lock, packageJson);
  const paths = Object.keys(shrinkwrap.packages).filter((path) => path !== "");

  it("locks every runtime dependency with its exact version, registry source and integrity", () => {
    for (const name of Object.keys(packageJson.dependencies)) {
      const entry: Entry = shrinkwrap.packages[`node_modules/${name}`];
      expect(entry).toEqual(lock.packages[`node_modules/${name}`]);
      expect(entry.resolved).toMatch(/^https:\/\/registry\.npmjs\.org\//);
      expect(entry.integrity).toMatch(/^sha512-/);
    }
    expect(inspectShrinkwrap(shrinkwrap, packageJson)).toEqual([]);
  });

  it("leaves out the development tree, which npm never installs for a dependency", () => {
    const production = Object.entries(lock.packages as Record<string, Entry & { devOptional?: boolean }>)
      .filter(([path, entry]) => path !== "" && !entry.dev && !entry.devOptional).map(([path]) => path);
    expect(paths.sort()).toEqual(production.sort());
    expect(shrinkwrap.packages[""]).not.toHaveProperty("devDependencies");
  });

  it("refuses a lock that does not satisfy package.json", () => {
    const stale = structuredClone(lock);
    stale.packages["node_modules/@iarna/toml"].version = "1.0.0";
    expect(() => productionShrinkwrap(stale, packageJson)).toThrow("does not satisfy");
  });

  it("names a tarball without a shrinkwrap, or with one for another version", () => {
    const files = ["npm-shrinkwrap.json"];
    expect(inspectShrinkwrap(null, packageJson)).toEqual(["missing npm-shrinkwrap.json"]);
    expect(inspectShrinkwrap({ ...shrinkwrap, version: "0.0.1" }, packageJson)[0]).toContain("not paseo-plugin-account-switcher@");
    expect(inspectPackage({ files, manifest: null, sourceManifest: {}, packageJson, shrinkwrap: null })).toContain("missing npm-shrinkwrap.json");
  });
});

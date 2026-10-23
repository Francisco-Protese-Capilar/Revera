import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("título da home", () => {
  it("usa o título da marca do layout, não o 'Próteses' do catálogo", () => {
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home).not.toMatch(/export\s*\{[^}]*\bmetadata\b/);
    expect(home).not.toMatch(/export\s+(const|async function)\s+(metadata|generateMetadata)\b/);
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("default: site.seoTitle");
  });
});

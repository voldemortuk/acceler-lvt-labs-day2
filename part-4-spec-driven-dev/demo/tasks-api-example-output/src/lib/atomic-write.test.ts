import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { atomicWriteFile } from "./atomic-write.js";

async function mkTmp() {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "aw-"));
  return d;
}

async function rmTmp(d: string) {
  await fs.rm(d, { recursive: true, force: true });
}

async function listTemps(dir: string, base: string) {
  const entries = await fs.readdir(dir);
  return entries.filter((e) => e.startsWith(base + ".tmp."));
}

describe("atomic-write", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkTmp();
  });
  afterEach(async () => {
    await rmTmp(dir);
    vi.restoreAllMocks();
  });

  it("writes new content producing a file equal to the input", async () => {
    const target = path.join(dir, "x.json");
    await atomicWriteFile(target, '{"a":1}');
    expect(await fs.readFile(target, "utf8")).toBe('{"a":1}');
  });

  it("overwrites existing content atomically", async () => {
    const target = path.join(dir, "x.json");
    await fs.writeFile(target, "old");
    await atomicWriteFile(target, "new");
    expect(await fs.readFile(target, "utf8")).toBe("new");
  });

  it("temp file name includes pid and random suffix, and is cleaned up", async () => {
    const target = path.join(dir, "x.json");
    let observedTemps: string[] = [];
    const origRename = fs.rename.bind(fs);
    // Cast: fs.rename has an overloaded signature that resists narrow typing.
    const spy = vi
      .spyOn(fs, "rename")
      .mockImplementation(
        async (from: Parameters<typeof fs.rename>[0], to: Parameters<typeof fs.rename>[1]) => {
          observedTemps = await listTemps(dir, "x.json");
          return origRename(from, to);
        }
      );
    await atomicWriteFile(target, "hi");
    spy.mockRestore();
    expect(observedTemps).toHaveLength(1);
    const t = observedTemps[0]!;
    expect(t).toMatch(
      new RegExp(`^x\\.json\\.tmp\\.${process.pid}\\.[0-9a-f]{16}$`)
    );
    // After success there is no temp remaining.
    expect(await listTemps(dir, "x.json")).toHaveLength(0);
  });

  it("cleans up temp file when rename fails (target unchanged)", async () => {
    const target = path.join(dir, "x.json");
    await fs.writeFile(target, "pre");
    const spy = vi
      .spyOn(fs, "rename")
      .mockRejectedValueOnce(new Error("simulated rename failure"));
    await expect(atomicWriteFile(target, "post")).rejects.toThrow(
      /simulated rename failure/
    );
    // Target unchanged.
    expect(await fs.readFile(target, "utf8")).toBe("pre");
    // No leftover temps.
    expect(await listTemps(dir, "x.json")).toHaveLength(0);
    spy.mockRestore();
  });

  it("cleans up temp file when writeFile fails", async () => {
    const target = path.join(dir, "x.json");
    // Force a write failure by patching the FileHandle returned by fs.open.
    const origOpen = fs.open.bind(fs);
    // Cast: fs.open and FileHandle.writeFile have complex overloads; the
    // shape below is what the atomic-write helper actually calls.
    const spy = vi
      .spyOn(fs, "open")
      .mockImplementationOnce(async (...args: unknown[]) => {
        const fh = await (origOpen as (...a: unknown[]) => Promise<import("node:fs/promises").FileHandle>)(
          ...args
        );
        fh.writeFile = (async () => {
          throw new Error("simulated write failure");
        }) as typeof fh.writeFile;
        return fh;
      });
    await expect(atomicWriteFile(target, "hi")).rejects.toThrow(
      /simulated write failure/
    );
    expect(await listTemps(dir, "x.json")).toHaveLength(0);
    spy.mockRestore();
  });

  it("simulated crash between writeFile and rename leaves target unchanged (50 iterations)", async () => {
    const target = path.join(dir, "x.json");
    await atomicWriteFile(target, '{"pre":true}');
    const preBytes = await fs.readFile(target, "utf8");

    for (let i = 0; i < 50; i++) {
      const spy = vi
        .spyOn(fs, "rename")
        .mockRejectedValueOnce(new Error("crash-" + i));
      await expect(
        atomicWriteFile(target, JSON.stringify({ iter: i }))
      ).rejects.toThrow(/crash-/);
      spy.mockRestore();
      // Target must still parse as the pre-state.
      const cur = await fs.readFile(target, "utf8");
      expect(cur).toBe(preBytes);
      expect(() => JSON.parse(cur)).not.toThrow();
      // No leftover temp files.
      expect(await listTemps(dir, "x.json")).toHaveLength(0);
    }
  });

  it("creates parent directory if missing", async () => {
    const target = path.join(dir, "sub", "nested", "x.json");
    await atomicWriteFile(target, "hi");
    expect(await fs.readFile(target, "utf8")).toBe("hi");
  });
});

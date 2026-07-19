import { promises as fs, constants as fsConstants } from "node:fs";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { promisify } from "node:util";

const fsyncAsync = promisify(fsSync.fsync);

/**
 * Sole persistence primitive (constitution V — Data Safety Over Convenience).
 *
 * Sequence: write temp → fsync temp → rename over target → fsync directory.
 * On any failure the temp file is removed. See specs/001-tasks-api/research.md
 * Decision 1 for the durability argument.
 */
export async function atomicWriteFile(
  targetPath: string,
  bytes: Buffer | string
): Promise<void> {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });

  const tempName =
    path.basename(targetPath) +
    ".tmp." +
    process.pid +
    "." +
    crypto.randomBytes(8).toString("hex");
  const tempPath = path.join(dir, tempName);

  let tempFh: import("node:fs/promises").FileHandle | null = null;
  try {
    tempFh = await fs.open(tempPath, "w");
    await tempFh.writeFile(bytes);
    await tempFh.sync();
    await tempFh.close();
    tempFh = null;
    await fs.rename(tempPath, targetPath);
    await fsyncDir(dir);
  } catch (err) {
    if (tempFh) {
      try {
        await tempFh.close();
      } catch {
        /* ignore */
      }
    }
    try {
      await fs.unlink(tempPath);
    } catch {
      /* temp may already be gone */
    }
    throw err;
  }
}

async function fsyncDir(dir: string): Promise<void> {
  // Directory fsync isn't supported on Windows; skip cleanly there.
  if (process.platform === "win32") return;
  const fd = fsSync.openSync(dir, fsConstants.O_RDONLY);
  try {
    await fsyncAsync(fd);
  } finally {
    fsSync.closeSync(fd);
  }
}

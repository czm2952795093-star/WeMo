import { cp, lstat, mkdir, readdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [nextBin, "build"], {
    cwd: root,
    env: { ...process.env, NEXT_OUTPUT_STANDALONE: "1" },
    stdio: "inherit",
  });

  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Next.js build exited with code ${code}`));
  });
});

const standalone = join(root, ".next", "standalone");
const publicTarget = join(standalone, "public");
const staticTarget = join(standalone, ".next", "static");

await rm(publicTarget, { recursive: true, force: true });
await rm(staticTarget, { recursive: true, force: true });
await mkdir(join(standalone, ".next"), { recursive: true });
await cp(join(root, "public"), publicTarget, { recursive: true });
await cp(join(root, ".next", "static"), staticTarget, { recursive: true });

async function materializeLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    const entryStat = await lstat(entryPath);

    if (entryStat.isSymbolicLink()) {
      const target = await realpath(entryPath);
      await rm(entryPath, { recursive: true, force: true });
      await cp(target, entryPath, { recursive: true, dereference: true });
      continue;
    }

    if (entryStat.isDirectory()) await materializeLinks(entryPath);
  }
}

await materializeLinks(standalone);

console.log("Prepared complete veFaaS standalone output.");

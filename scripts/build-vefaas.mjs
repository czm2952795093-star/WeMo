import { cp, lstat, mkdir, readdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

if (process.platform !== "linux" || process.arch !== "x64" || Number(process.versions.node.split(".")[0]) !== 20) {
  throw new Error("veFaaS native-node20 artifacts must be built on Linux x64 with Node 20. On Windows use: wsl -d Ubuntu -- bash scripts/build-vefaas-linux.sh");
}
const glibc = process.report.getReport().header.glibcVersionRuntime;
if (!glibc || Number(glibc.split(".")[0]) !== 2 || Number(glibc.split(".")[1]) > 31) {
  throw new Error("native-node20/v1 uses glibc 2.31. Build with scripts/build-vefaas-bullseye.sh to avoid incompatible native addons.");
}

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

const artifactRequire = createRequire(join(standalone, "server.js"));
for (const dependency of ["better-sqlite3", "sharp"]) {
  if (!artifactRequire.resolve(dependency).startsWith(`${standalone}/`)) {
    throw new Error(`Standalone output is missing ${dependency}`);
  }
}
const Sqlite = artifactRequire("better-sqlite3");
const database = new Sqlite(":memory:");
database.prepare("SELECT 1").get();
database.close();
await artifactRequire("sharp")({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();

console.log("Prepared complete veFaaS standalone output.");

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const artifact = join(process.cwd(), ".vefaas", "linux-standalone");
for (const path of ["server.js", "node_modules/next/dist/server/next.js", "public", ".next/static"]) {
  await stat(join(artifact, path));
}
let nativeModules = 0;
async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Deployment artifact contains a link: ${path}`);
    if (entry.isDirectory()) await verify(path);
    else if (entry.name.endsWith(".node")) {
      const bytes = await readFile(path);
      if (!bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || bytes.readUInt16LE(18) !== 62) {
        throw new Error(`Native module is not Linux x64 ELF: ${path}`);
      }
      nativeModules++;
    } else if (/^\.env(?:\.|$)/.test(entry.name)) {
      throw new Error(`Deployment artifact must not include secrets: ${path}`);
    }
  }
}
await verify(artifact);
if (!nativeModules) throw new Error("Native dependencies are missing from deployment artifact.");
console.log(`Verified standalone artifact with ${nativeModules} Linux x64 native modules.`);

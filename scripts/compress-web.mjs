import { readdir, readFile, writeFile } from "node:fs/promises";
import { brotliCompress, gzip, constants } from "node:zlib";
import { promisify } from "node:util";

const root = new URL("../apps/web/dist/", import.meta.url);
const br = promisify(brotliCompress),
  gz = promisify(gzip);
let original = 0,
  brotli = 0,
  zipped = 0;
async function compress(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = new URL(
      entry.name + (entry.isDirectory() ? "/" : ""),
      directory,
    );
    if (entry.isDirectory()) {
      await compress(file);
      continue;
    }
    if (!entry.isFile() || !/\.(?:js|css|html|svg)$/.test(entry.name)) continue;
    const source = await readFile(file);
    const [small, legacy] = await Promise.all([
      br(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
      gz(source, { level: 9 }),
    ]);
    original += source.length;
    brotli += Math.min(source.length, small.length);
    zipped += Math.min(source.length, legacy.length);
    if (small.length < source.length)
      await writeFile(new URL(file.href + ".br"), small);
    if (legacy.length < source.length)
      await writeFile(new URL(file.href + ".gz"), legacy);
  }
}
await compress(root);
console.log(
  JSON.stringify({
    public_text_bytes: original,
    brotli_bytes: brotli,
    gzip_bytes: zipped,
  }),
);

import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export async function checkLinks(root, files) {
  const errors = [];
  let links = 0;
  for (const file of files.filter(path => path.endsWith(".md"))) {
    const source = resolve(root, file);
    const text = (await readFile(source, "utf8")).replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, "");
    for (const match of text.matchAll(/!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
      const url = match[1] ?? match[2];
      if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(url)) continue;
      const target = decodeURIComponent(url.split(/[?#]/, 1)[0]);
      if (!target) continue;
      const path = resolve(dirname(source), target);
      const local = relative(root, path);
      links++;
      if (local === ".." || local.startsWith(`..${sep}`)) {
        errors.push(`${file}: link escapes repository: ${url}`);
        continue;
      }
      try { await stat(path); }
      catch (error) {
        if (error.code !== "ENOENT") throw error;
        errors.push(`${file}: missing local target: ${url}`);
      }
    }
  }
  return { files: files.filter(path => path.endsWith(".md")).length, links, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean))];
  const result = await checkLinks(root, files);
  for (const error of result.errors) console.error(error);
  console.log(`Checked ${result.files} Markdown files and ${result.links} local links; ${result.errors.length} errors.`);
  process.exitCode = result.errors.length ? 1 : 0;
}

import { readdir, mkdir } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const source = join(root, 'cards');
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await visit(path); continue; }
    if (!entry.name.endsWith('.png')) continue;
    const name = relative(source, path).replace(/\.png$/, '.webp');
    for (const [folder, width] of [['card-fast', 360], ['card-table', 720]]) {
      const output = join(root, folder, name);
      await mkdir(dirname(output), { recursive: true });
      await sharp(path).resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toFile(output);
    }
  }
}
await visit(source);

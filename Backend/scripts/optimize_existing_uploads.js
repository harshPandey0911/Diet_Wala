/**
 * One-time clean-up: shrinks pictures in the uploads folder that are much bigger than any screen needs
 * (e.g. a 1.3 MB menu photo). Run it on the server where the uploads live:
 *
 *   node scripts/optimize_existing_uploads.js --dry     # only list what would change
 *   node scripts/optimize_existing_uploads.js           # do it
 *
 * Safety: the original of every changed file is first copied to <uploads>/.original/, the file name
 * stays the same (so no database or link changes), and a file is only replaced when the new one is
 * at least 20% smaller. Only .webp/.jpg/.jpeg/.png files bigger than 250 KB are touched; webp files
 * stay webp. To undo: copy the files from .original/ back.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
const { getUploadDirectory } = await import('../src/services/upload.service.js');

const DRY = process.argv.includes('--dry');
const MIN_BYTES = 250 * 1024;
const MAX_SIDE = 1200;

const root = path.resolve(getUploadDirectory());
const backupDir = path.join(root, '.original');
const files = fs.readdirSync(root).filter((f) => /\.(webp|jpe?g|png)$/i.test(f));

let before = 0;
let after = 0;
let changed = 0;
for (const file of files) {
  const full = path.join(root, file);
  const size = fs.statSync(full).size;
  if (size < MIN_BYTES) continue;
  try {
    const resized = sharp(full).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    const ext = path.extname(file).toLowerCase();
    const buffer = ext === '.png'
      ? await resized.png({ compressionLevel: 9, palette: true, quality: 80 }).toBuffer()
      : ext === '.webp'
        ? await resized.webp({ quality: 80 }).toBuffer()
        : await resized.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    if (buffer.length > size * 0.8) continue;
    console.log(`${DRY ? '[dry] ' : ''}${file}: ${(size / 1024).toFixed(0)} KB -> ${(buffer.length / 1024).toFixed(0)} KB`);
    before += size;
    after += buffer.length;
    changed += 1;
    if (!DRY) {
      fs.mkdirSync(backupDir, { recursive: true });
      if (!fs.existsSync(path.join(backupDir, file))) fs.copyFileSync(full, path.join(backupDir, file));
      fs.writeFileSync(full, buffer);
    }
  } catch (error) {
    console.warn(`skipped ${file}: ${error.message}`);
  }
}
console.log(`\n${DRY ? 'Would change' : 'Changed'} ${changed} file(s): ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
process.exit(0);

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { nanoid } from 'nanoid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
export const UPLOAD_URL_PREFIX = '/uploads';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// This is a local-disk implementation of "put an image somewhere and give me
// a URL back". If this app grows beyond a single server, swap the storage
// engine below for one that uploads to S3 / GCS / Cloudinary and returns a
// remote URL instead — nothing outside this file needs to change, since
// routes only ever call `publicUrlFor(filename)`.
const engine = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${nanoid(8)}${ext}`);
  },
});

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const uploadPrizeImage = multer({
  storage: engine,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, WEBP or GIF images are allowed'));
    }
    cb(null, true);
  },
});

export function publicUrlFor(filename) {
  return `${UPLOAD_URL_PREFIX}/${filename}`;
}

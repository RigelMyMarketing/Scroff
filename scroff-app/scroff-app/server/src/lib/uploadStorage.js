import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary-backed multer storage engine. This replaces the old
// multer.diskStorage engine so uploaded prize photos live on Cloudinary
// instead of local disk — meaning they survive redeploys/restarts even on
// hosts with no persistent disk. Nothing outside this file needs to change:
// `imagePath` now stores a full Cloudinary URL instead of a filename, and
// `publicUrlFor` just returns it as-is.
class CloudinaryStorage {
  _handleFile(req, file, cb) {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'scroff-prizes', resource_type: 'image' },
      (err, result) => {
        if (err) return cb(err);
        cb(null, { filename: result.secure_url, size: result.bytes });
      }
    );
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    cb(null);
  }
}

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const uploadPrizeImage = multer({
  storage: new CloudinaryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, WEBP or GIF images are allowed'));
    }
    cb(null, true);
  },
});

export function publicUrlFor(imagePath) {
  // imagePath is already a full Cloudinary URL.
  return imagePath;
}

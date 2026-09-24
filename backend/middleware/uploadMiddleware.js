import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure backend/uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    cb(null, `${uniqueSuffix}-${baseName}${ext}`);
  },
});

// File filter accepting images and videos
const mediaFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp4", ".webm", ".avi", ".mov", ".mkv"
  ];

  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/x-msvideo",
    "video/quicktime",
    "video/x-matroska",
    "application/octet-stream"
  ];

  const mime = (file.mimetype || "").toLowerCase();
  if (allowedExts.includes(ext) || allowedMimeTypes.includes(mime)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only standard images (JPEG, PNG, WebP) and videos (MP4, WebM, AVI, MOV, MKV) are allowed."
      ),
      false
    );
  }
};

// Video specific filter
const videoFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedVideoExts = [".mp4", ".webm", ".avi", ".mov", ".mkv"];
  const isVideoMime = (file.mimetype || "").toLowerCase().startsWith("video/") ||
                      file.mimetype === "application/octet-stream";

  if (allowedVideoExts.includes(ext) || isVideoMime) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type for video detection. Only MP4, WebM, AVI, MOV, and MKV files are accepted."
      ),
      false
    );
  }
};

export const upload = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

export const videoUpload = multer({
  storage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for video
  },
});

// Flexible middleware that accepts either 'image' or 'file' form field
export const uploadImageFlexible = (req, res, next) => {
  const uploadHandler = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 }
  ]);

  uploadHandler(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      req.file = req.files.image?.[0] || req.files.file?.[0] || null;
    }
    next();
  });
};

// Flexible middleware that accepts either 'video' or 'file' form field
export const uploadVideoFlexible = (req, res, next) => {
  const uploadHandler = videoUpload.fields([
    { name: "video", maxCount: 1 },
    { name: "file", maxCount: 1 }
  ]);

  uploadHandler(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      req.file = req.files.video?.[0] || req.files.file?.[0] || null;
    }
    next();
  });
};

export default upload;

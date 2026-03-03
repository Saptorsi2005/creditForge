const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
function sanitizeFilename(filename) {
    // Strip any directory components, keep only the base filename
    return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Disk storage with unique filenames and path traversal prevention
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(sanitizeFilename(file.originalname)).toLowerCase();
        const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
        cb(null, uniqueName);
    },
});

/**
 * MIME type validation – aligned with Settings.allowedFileTypes
 */
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                `Invalid file type "${file.mimetype}". Allowed: PDF, CSV, Excel.`
            ),
            false
        );
    }
};

/**
 * Max file size from environment (default 10 MB)
 */
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024;

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
});

module.exports = { upload, uploadsDir };

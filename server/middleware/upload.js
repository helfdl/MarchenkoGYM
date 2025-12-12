const fs = require('fs');
const path = require('path');
const multer = require('multer');

const trainersImagesPath = path.join(__dirname, '..', '..', 'client', 'images', 'trainers');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(trainersImagesPath)) {
            fs.mkdirSync(trainersImagesPath, { recursive: true });
        }
        cb(null, trainersImagesPath);
    },
    filename: (req, file, cb) => {
        const trainerId = req.params.id || req.body.trainer_id || 'unknown';
        const extension = path.extname(file.originalname) || '.jpg';
        cb(null, `trainer-${trainerId}${extension}`);
    }
});

function imageFileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Только изображения разрешены'));
    }
}

const trainerPhotoUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter
});

module.exports = { trainerPhotoUpload };


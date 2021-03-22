const multer = require("multer")
const sharp = require("sharp")
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const maxSize = 1024 * 1024 * 2.5; // 2.5MB
// const multerStorage = multer.memoryStorage()
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, `/../static/upload`))
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + path.extname(file.originalname))
  }
})

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video')) {
    cb(null, true)
  } else {
    cb("Please upload only files and/or videos.", false)
  }
}

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: maxSize },
  fileFilter: multerFilter
})

const uploadFilesBuffer = upload.array("files", 10)


module.exports = {
  deleteFile:  (req, res, next) => {
    let result = req.body.files.map(e => {
      let filename = e.split('/').pop().trim()
      try {
        fs.unlinkSync(path.join(__dirname, `/../static/upload/${filename}`))
        return e
        //file removed
      } catch(err) {
        console.error(err)
        return e
      }
    })
    return res.json(result)
  },
  uploadFiles: (req, res, next) => {
    uploadFilesBuffer(req, res, err => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          // return res.send("Too many files to upload.")
          return res.json({ status: 'error', message: `Too many files to upload` })
        } else if (err.code === "LIMIT_FILE_SIZE") {
          // return res.send(`File too large. Max allowed size is ${maxSize} bytes`)
          return res.json({ status: 'error', message: `File too large. Max allowed size is ${maxSize} bytes` })
        }
      } else if (err) {
        return res.json({ status: 'error', message: err })
        // return res.send(err)
      }

      next()
    })
  },
  resizeImages: async (req, res, next) => {
    if (!req.files) return next()

    req.body.files = []
    await Promise.all(
      req.files.map(async file => {
        req.body.files.push(file.filename)
      })
    )

    next()
  },
  getResult: async (req, res) => {
    if (req.body.files.length <= 0) {
      return res.send(`You must select at least 1 image.`)
    }

    const files = req.body.files
      .map(file => process.env.BUCKET_URL + '/' + file)

    return res.send(files)
  },
  getFiles: (req, res) => {
    const directoryPath = path.join(__dirname, '/../static/upload');
    fs.readdir(directoryPath, function (err, files) {
      if (err) {
        return console.log('Unable to scan directory: ' + err);
      }
      const list = files
        .map(file => process.env.BUCKET_URL + '/' + file)
        return res.json(list)
    })
  }
}
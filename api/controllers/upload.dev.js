const multer = require("multer")
const sharp = require("sharp")
const path = require('path')
const fs = require('fs')
const prefix = 'yacabron'
// const multerStorage = multer.memoryStorage()
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, `/../static/upload`))
  },
  filename: function (req, file, cb) {
    cb(null, `${prefix}-${Date.now()}` + path.extname(file.originalname))
  }
})

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')||file.mimetype.startsWith('video')) {
    cb(null, true)
  } else {
    cb("Please upload only files and/or videos.", false)
  }
}

const upload = multer({
  storage: multerStorage,
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
          return res.send("Too many files to upload.")
        }
      } else if (err) {
        return res.send(err)
      }

      next()
    })
  },
  resizeImages: async (req, res, next) => {
    if (!req.files) return next()

    req.body.files = []
    await Promise.all(
      req.files.map(async file => {
        console.log(file.buffer)
        await sharp(file.buffer)
          .resize(640, 480)
          .toFormat("jpg")
          .jpeg({ quality: 90 })
          .toFile(path.join(__dirname, `/../static/upload/${file.filename}`))

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

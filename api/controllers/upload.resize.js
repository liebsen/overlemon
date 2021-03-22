const multer = require("multer")
const sharp = require("sharp")
const path = require('path')
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
    cb("Please upload only images and/or videos.", false)
  }
}

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
})

const uploadFiles = upload.array("files", 10)

const deleteFile = (req, res, next) => {
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
}

const getFiles = (req, res) => {
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

const uploadImages = (req, res, next) => {
  uploadFiles(req, res, err => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.send("Too many files to upload.")
      }
    } else if (err) {
      return res.send(err)
    }

    next()
  })
}

const resizeImages = async (req, res, next) => {
  if (!req.files) return next()

  req.body.images = []
  await Promise.all(
    req.files.map(async file => {
      const filename = file.originalname.replace(/\..+$/, "")
      const newFilename = `${prefix}-640x480-${Date.now()}.jpeg`

      await sharp(file.buffer)
        .resize(640, 480)
        .toFormat("jpeg")
        .jpeg({ quality: 100 })
        .toFile(path.join(__dirname, `/../static/upload/${newFilename}`))

      req.body.images.push(newFilename)
    })
  )

  next()
}

const getResult = async (req, res) => {
  if (req.body.images.length <= 0) {
    return res.send(`You must select at least 1 image.`)
  }

  const images = req.body.images
    .map(file => req.protocol+'://'+req.headers.host + '/upload/' + file)

  return res.send(images)
}

module.exports = {
  uploadImages: uploadImages,
  resizeImages: resizeImages,
  deleteFile: deleteFile,
  getFiles: getFiles,
  getResult: getResult
}
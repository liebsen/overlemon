const express = require('express')
const app = express()
const fs = require('fs')
const bodyParser = require('body-parser')
var cors = require('cors')
var path = require('path')
var emailHelper = require('./email/helper')
var email = emailHelper()
var server = require('http').Server(app)

app.use(bodyParser.urlencoded({ extended: false}))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(express.json())
app.use(express.urlencoded())

app.use(cors())

/*
const allowedOrigins = [
  'http://ol.com',
  'https://overlemon.com',
  'https://freecatradio.com',
  'https://ice.overlemon.com'
]

app.use(cors({
  origin: function(origin, callback){
    // allow requests with no origin 
    // (like mobile apps or curl requests)
    if(!origin) {
      console.log("not allowed origin to unknown")
      return callback(null, true)
    }
    if(allowedOrigins.indexOf(origin) === -1){
      var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.'
      console.log("not allowed origin")
      console.log(origin)
      return callback(new Error(msg), false)
    }
    return callback(null, true)
  }
}))
*/

var log = str => {
  let now = new Date().toISOString()
  fs.appendFile('debug.log', `${now} ${str}\n`, err => {
    if (err) throw err;
  })
}

app.post('/debug', (req, res) => {
  log(`${req.ip} error: ${req.body.err}`)
  res.sendStatus(200)
})

app.post('/contact', (req, res) => {
  email.send({
    to: process.env.EMAIL_PRIMARY,
    subject: 'Contacto desde la web',
    data: {
      title: 'Contacto desde la web',
      message: 'Nombre: ' + req.body.name + '<br>Teléfono : ' + req.body.phone + '<br>Email: ' + req.body.email + '<br>Comments : ' + req.body.comment + '<br>',
      link: '',
      linkText: ''
    },
    templatePath:path.join(__dirname,'/email/template.html')
  }).then(() => {
    console.log('sent')
    return res.json({ status: 'success', message: 'The message was successfully sent. Thank you for your contact. We will respond ASAP.' })
  }).catch(err => {
    if(err) console.log(err)
    return res.json({ status: 'error', message: `Error: ${err}` })
  })
})

app.get('/bg_video', function(req, res) {

  var files = fs.readdirSync(path.join(__dirname,'/videos'))
  /* now files is an Array of the name of the files in the folder and you can pick a random name inside of that array */
  const chosenFile = files[Math.floor(Math.random() * files.length)] 
  const file = path.join(__dirname,`/videos/${chosenFile}`)
  console.log(chosenFile)
  // const path = chosenFile
  const stat = fs.statSync(file)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1]
      ? parseInt(parts[1], 10)
      : fileSize-1

    if(start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
      return
    }
    
    const chunksize = (end-start)+1
    const file = fs.createReadStream(file, {start, end})
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    }

    res.writeHead(206, head)
    file.pipe(res)
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    }
    res.writeHead(200, head)
    fs.createReadStream(file).pipe(res)
  }
})

server.listen(process.env.PORT || 5000)
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
  console.log(req.body)
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

server.listen(process.env.PORT || 5000)
const express = require('express')
const app = express()
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

const allowedOrigins = [
  'http://ol.com',
  'https://overlemon.com',
  'https://freecatradio.com',
  'https://hub.overlemon.com'
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

app.post('/contact', (req, res) => {
  console.log(req.body)
  email.send({
    to:process.env.EMAIL_PRIMARY,
    subject:'Contacto desde la web',
    data:{
      title:'Contacto desde la web',
      message: 'Nombre: ' + req.body.name + '<br>Teléfono : ' + req.body.phone + '<br>Email: ' + req.body.email + '<br>Comments : ' + req.body.comment + '<br>',
      link: '',
      linkText: ''
    },
    templatePath:path.join(__dirname,'/email/template.html')
  }).then(function(){
    res.sendStatus(200)
  }).catch(function(err){
    if(err) console.log(err)
    res.sendStatus(200)
  })
})

server.listen(process.env.PORT || 5000)
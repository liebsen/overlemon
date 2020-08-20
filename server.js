const express = require('express')
const app = express()
var emailHelper = require('./email/helper')
var email = emailHelper()
var server = require('http').Server(app)

app.post('/contact', (req, res) => {
  email.send({
    to:process.env.EMAIL_PRIMARY,
    subject:'Contacto desde la web',
    data:{
      title:'Contacto desde la web',
      message: 'Nombre: ' + req.body.name + '<br>Teléfono : ' + req.body.phone + '<br>Email: ' + req.body.email + '<br>Comments : ' + req.body.comments + '<br>',
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

server.listen(process.env.PORT || 4000)
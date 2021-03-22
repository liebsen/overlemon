const path = require("path")
const bson = require('bson')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const ObjectId = require('mongodb').ObjectId
const default_avatar = 'https://panel.festive.com.ar/svg/FestiveF.svg'

module.exports = {
  data: (req, res) => {
    req.app.db.collection('zonas').find({
      activo: true
    }).toArray((err,zonas) => {
      req.app.db.collection('rubros').find({
        activo: true
      }).toArray((err,rubros) => {
        return res.json({
          rubros: rubros,
          zonas: zonas
        })
      })
    })
  },
  register: (req, res) => {
    req.app.db.collection('proveedores').findOne({
      email: req.body.email
    },function(err, doc) {
      if (doc) {
        return res.json({
          status: 'error',
          message: 'email_already_exists'
        })
      } else {
        let validation_code = new bson.ObjectID().toString()
        req.body.codigo = validation_code
        req.body.avatar = default_avatar
        req.body.created = new Date
        req.body.rol = 'solicitante'

        delete req.body.email_confirma

        req.app.db.collection('proveedores').insertOne(req.body, function (err, results) {
          if(err) {
            res.status(200).send({ status: 'error: ' + err })
          } else {
            return emailClient.send({
              to:req.body.email,
              subject: 'Recibimos tu solicitud',
              data:{
                title:`Hola ${req.body.nombre}, ¡Recibimos tu solicitud!`,
                message:'Gracias por tomarte el tiempo de solicitar acceso a nuestra plataforma, estaremos revisando tus datos y eventualmente te enviaremos un email con un enlace para activar tu cuenta.',
                link: process.env.APP_URL + '/proveedores-festive',
                linkText:'Conocer más acerca de Festive',
                tag: 'proveedor'
              },
              templatePath:path.join(__dirname,'/../email/template.html')
            }).catch(function(err){
              if(err) console.log(err)
            }).then(function(){
              res.status(200).send({ status: 'success' });
            })
          }
        })
      }
    })
  }
}
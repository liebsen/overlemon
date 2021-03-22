const path = require("path")
const bson = require('bson')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const tokenExpires = 86400 * 30 * 12 // 1 year
const saltRounds = 10
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const ObjectId = require('mongodb').ObjectId

module.exports = {
  login: (req, res) => {
    var email = req.body.email.toLowerCase()
    var password = req.body.password
    req.app.db.collection('proveedores').findOne({
      email: email,
      plan: { "$in": ['free', 'premium'] }
    },function(err, doc) {
      if (err) return res.status(500).send('Error on the server:' + err)
      if (!doc) return res.status(404).send({ auth: false, token: null })
      if(doc.rol === 'deshabilitado' || doc.plan === '') res.status(402).send({ auth: false, token: null })

      let passwordIsValid = bcrypt.compareSync(req.body.password, doc.password)
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })

      // update lastlogin
      req.app.db.collection('proveedores').findOneAndUpdate({
        _id: doc._id
      },
      {
        "$set": {
          lastlogin: moment().utc().format()
        }
      },{ 
        upsert: true, 
        'new': true, 
        returnOriginal:false 
      }).then(function(user) {  
        // delete doc.password
        let token = jwt.sign({ id: doc._id }, process.env.APP_SECRET, {
          expiresIn: tokenExpires
        })
        res.status(200).send({
          auth: true,
          token: token,
          user: doc
        })
      })
    })
  },
  token:  (req, res) => {
    req.app.db.collection('proveedores').find({
      '_id': new ObjectId(req.decoded.id)
    })
    .limit(1)
    .toArray(function(err,results){
      return res.json({
        status: 'success',
        data:results[0]
      })
    })  
  },
  data: (req, res) => {
    req.app.db.collection('zonas').find({
      activo: true
    }).toArray((err,docs) => {
      const zonas = docs
      req.app.db.collection('rubros').find({
        activo: true
      }).toArray((err,docs2) => {
        const rubros = docs2
        req.app.db.collection('planes').find(
        ).toArray((err,docs4) => {
          const planes = docs4
          return res.json({
            zonas: zonas, 
            rubros: rubros,
            planes: planes
          })
        })
      })
    })
  },
  provider: (req, res) => {
    req.app.db.collection('proveedores').find({
      _id: new ObjectId(req.decoded.id)
    }).toArray((err,docs) => {
      return res.json(docs[0])
    })
  },
  downgrade: (req, res) => {
    req.app.db.collection('proveedores').findOneAndUpdate({
      _id: new ObjectId(req.decoded.id)
    },
    {
      "$set": {
        plan: 'free',
        plan_updated: new Date()
      }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(user) {  
      let token = jwt.sign({ id: user.value._id }, process.env.APP_SECRET, {
        expiresIn: tokenExpires
      })
      res.status(200).send({ auth: true, token: token, user: user.value });
    }).catch(function(err){
      if(err) return res.status(500).send("There was a problem getting user " + err)
    })
  },
  change_password: (req, res) => {
    var password = req.body.password
    req.app.db.collection('proveedores').findOne({
      _id: new ObjectId(req.decoded.id)
    },function(err, doc) {
      if (err) return res.status(500).send('Error on the server:' + err)
      if (!doc) return res.status(404).send({ auth: false, token: null })
      if(doc.rol === 'deshabilitado') res.status(402).send({ auth: false, token: null })

      let passwordIsValid = bcrypt.compareSync(req.body.old_password, doc.password)
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })

      bcrypt.hash(req.body.new_password, saltRounds, function (err, hash) {
        req.app.db.collection('proveedores').findOneAndUpdate({
          _id: new ObjectId(req.decoded.id)
        },
        {
          "$set": {
            password: hash
          }
        },{ 
          upsert: true, 
          'new': true, 
          returnOriginal:false 
        }).then(function(user) {  
          let token = jwt.sign({ id: user.value._id }, process.env.APP_SECRET, {
            expiresIn: tokenExpires
          })
          res.status(200).send({ auth: true, token: token, user: user.value });
        }).catch(function(err){
          if(err) return res.status(500).send("There was a problem getting user " + err)
        })
      })
    })
  },
  validate_code: (req, res) => {
    req.app.db.collection('proveedores').findOne({
      codigo_invitacion: req.body.code
    },function(err, result) {
      if (err) return res.status(500).send('Error on the server.')
      if (!result) return res.status(404).send('No code found.')
      if (result.password) {
        return res.status(403).send('User already registered')
      }
      return res.status(200).send({
        status:'success',
        nombre: result.nombre
      })
    })
  },
  validate: (req, res) => {
    req.app.db.collection('shops').findOneAndUpdate({
      invitation_code: req.params.code
    },
    {
      "$set": {
        codigo: null,
        validado: true,
        fecha_validacion: moment().utc().format()
      }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal: false 
    }).then(function(user) {  
      let token = jwt.sign({ id: user.value._id }, process.env.APP_SECRET, {
        expiresIn: tokenExpires
      })
      res.status(200).send({ auth: true, token: token, user: user.value });
    }).catch(function(err){
      if(err) return res.status(500).send("There was a problem getting user " + err)
    })
  },
  create: (req, res) => {
    var password = req.body.password
    var codigo_validacion = new bson.ObjectID().toString()

    bcrypt.hash(password, saltRounds, function (err, hash) {
      req.app.db.collection('proveedores').findOneAndUpdate({
        codigo_invitacion: req.body.code,
        password: null,
      },
      {
        "$set": {
          password: hash,
          validado: false,
          codigo_validacion: codigo_validacion,
          fecha_registro: moment().utc().format(),
          plan: 'free',
          rol: 'proveedor'
        }
      },{ 
        upsert: true, 
        'new': true, 
        returnOriginal:false 
      }).then(function(doc) {   
        return emailClient.send({
          to:doc.value.email,
          subject: 'Validación de cuenta',
          data: {
            title:'¡Bienvenid@ ' + doc.value.nombre + '!',
            message:'Estamos muy contentos de contar contigo, trabajaremos arduamente para llevar tu negocio a un siguiente nivel.',
            link: process.env.PANEL_URL,
            linkText:'Ir a mi panel',
            tag: 'proveedor'
          },
          templatePath:path.join(__dirname,'/../email/template.html')
        }).catch(function(err){
          if(err) console.log(err)
        }).then(function(){
          res.status(200).send({ status: 'success' });
        })
      }).catch((err) => {
        res.status(404).send('No code found. ' + err);
      }) 
    })
  },
  register: (req, res) => {
    var validation_code = new bson.ObjectID().toString()

    req.body.codigo = validation_code
    req.body.created = new Date
    req.body.rol = 'solicitante'
    delete req.body.email_confirma

    req.app.db.collection('proveedores').insertOne(req.body, function (err, results) {
      if(err) {
        res.status(200).send({ status: 'error: ' + err })
      } else {
        return emailClient.send({
          to:req.body.email,
          subject: 'Recepción de solicitud',
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
  },
  requests: (req, res) => {
    req.app.db.collection('proveedores').find({
      _id: new ObjectId(req.decoded.id) 
    }).toArray((err,proveedor) => {
      if(!proveedor[0].rubros || !proveedor[0].zonas) {
        return res.json({
          status: 'error',
          message: 'Debes configurar primero tus preferencias de Visibilidad'
        })
      }

      let serviciosIds = proveedor[0].rubros.map(e => {
        return e.servicios.map(i => i._id)
      })
      let localidadesIds = proveedor[0].zonas.map(e => {
        return e.localidades.map(i => i._id)
      })
      req.app.db.collection('presupuestos').find({
        servicio: { $in: serviciosIds[0] },
        localidad: { $in: localidadesIds[0] },
      }).toArray((err,generales) => {
        return res.json({
          status: 'success',
          generales: generales,
          directas: proveedor[0].consultas
        })
      })
    })
  },
  respond: (req, res) => {
    let $push_query = []
    let data = req.body.data

    $push_query.push({
      respuesta: req.body.respuesta,
      created: new Date()
    })

    req.app.db.collection('proveedores').findOne({
      _id: new ObjectId(req.decoded.id),
      'consultas._id' : req.params.id
    },function(err, directa) {
      return new Promise((resolve, reject) => {
        if (directa) {
          req.app.db.collection('proveedores').findOneAndUpdate(
          {
            _id: new ObjectId(req.decoded.id),
            'consultas._id' : req.params.id
          },
          {
            "$push": { "consultas.$.conversacion": { "$each" : $push_query } }
          },
          { 
            upsert: true, 
            'new': false,
            returnOriginal: true
          }).then(function(doc){
            resolve(doc.value)
          }).catch(function(err){
            if(err){
              return res.json({
                status: 'error: ' + err
              })
            }
          })
        } else {
          data.conversacion = $push_query
          data.general = true
          req.app.db.collection('proveedores').findOneAndUpdate(
          {
            _id: new ObjectId(req.decoded.id),
          },
          {
            "$push": { "consultas": data }
          },
          { 
            upsert: true, 
            'new': false,
            returnOriginal: true
          }).then(function(doc){
            resolve(doc.value)
          }).catch(function(err){
            if(err){
              return res.json({
                status: 'error: ' + err
              })
            }
          })
        }
      }).then(doc => {
        return emailClient.send({
          to: req.body.email,
          subject: 'Respondieron a tu solicitud de presupuesto',
          data: {
            title:`Hola, ${doc.empresa} te envió una respuesta sobre tu solicitud de presupuesto.`,
            message:`
              <figure>
                <blockquote>${req.body.respuesta}</blockquote>
                <figcaption><strong>${doc.nombre}</strong></figcaption>
              </figure>
              <p>
                <span><a style="color:#CBAAC7" href="tel:${doc.telefono}">${doc.telefono}</a></span><br>
                <span><a style="color:#CBAAC7" href="mailto:${doc.email}">${doc.email}</a></span>
              </p>`,
            link: process.env.APP_URL,
            linkText:'Buscar más oportunidades',
            tag: 'cliente'
          },
          templatePath:path.join(__dirname,'/../email/template.html')
        }).catch(function(err){
          if(err) console.log(err)
        }).then(function(){
          res.status(200).send({ status: 'success' });
        })
      })
    })
  },
  restore_password: (req, res) => {
    req.app.db.collection('proveedores').findOne({
      email: req.body.email,
      rol: 'proveedor'
    },function(err, account) {
      if (!account) return res.status(404).send('No account found.')
      var code = new bson.ObjectID().toString()
      req.app.db.collection('proveedores').findOneAndUpdate(
      {
        email: req.body.email,
        rol: 'proveedor'
      },
      {
        "$set": { codigo_recuperacion: code }
      },
      { 
        upsert: true, 
        'new': false,
        returnOriginal: true
      }).then(function(doc){
        return emailClient.send({
          to: req.body.email,
          subject: 'Restaurar contraseña',
          data: {
            title:`Hola, ${doc.value.nombre}. Solicitaste ayuda con tu contraseña.`,
            message:`Alguien solicitó una restauración de constraseña. Si no fuiste vos quien la solicitó podés ignorar este mensaje. `,
            link: process.env.PANEL_URL + '/actualizar-contrasena/' + code,
            linkText:'Actualizar mi contraseña ahora',
            tag: 'proveedor'
          },
          templatePath:path.join(__dirname,'/../email/template.html')
        }).then(function(){
          res.json({
            status: 'success'
          })
        }).catch(function(err){
          if(err) console.log(err)
          res.json({
            status: 'error: ' + err
          })
        })
      })
    })
  },
  update_password: (req, res) => {
    req.app.db.collection('proveedores').findOne({
      codigo_recuperacion: req.body.code,
      rol: 'proveedor'
    },function(err, account) {
      if (!account) return res.status(404).send('No account found.')
      let password = req.body.password
      bcrypt.hash(password, saltRounds, function (err, hash) {
        req.app.db.collection('proveedores').findOneAndUpdate(
        {
          codigo_recuperacion: req.body.code,
          rol: 'proveedor'
        },
        {
          "$set": { 
            password: hash,
            codigo_recuperacion: null 
          }
        },
        { 
          upsert: true, 
          'new': false,
          returnOriginal: true
        }).then(function(doc){
          return emailClient.send({
            to: req.body.email,
            subject: 'Contraseña actualizada',
            data: {
              title:`Hola, ${doc.nombre}. Actualizaste tu contraseña.`,
              message:`El proceso de recuperación de cuenta se completó con éxito. Ya podés iniciar sesión con tu nueva contraseña.`,
              link: process.env.PANEL_URL + '/iniciar-sesion',
              linkText:'Iniciar sesión ahora',
              tag: 'proveedor'
            },
            templatePath:path.join(__dirname,'/../email/template.html')
          }).then(function(){
            res.json({
              status: 'success'
            })
          }).catch(function(err){
            if(err) console.log(err)
            res.json({
              status: 'error: ' + err
            })
          })
        })
      })
    })
  }
}
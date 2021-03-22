const path = require("path")
const bson = require('bson')
const bcrypt = require('bcrypt')
const moment = require('moment')
const jwt = require('jsonwebtoken')
const tokenExpires = 86400 * 30 * 12 // 1 year
const saltRounds = 10
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const ObjectId = require('mongodb').ObjectId

module.exports = {
  token:  (req, res) => {
    req.app.db.collection('admins').find({
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
  login: (req, res) => {
    var email = req.body.email.toLowerCase()
    var password = req.body.password
    req.app.db.collection('admins').findOne({
      email: email
    },function(err, user) {
      if (err) return res.status(500).send('Error on the server.')
      if (!user) return res.status(404).send('No user found.')

      // update lastlogin
      req.app.db.collection('admins').findOneAndUpdate({
        _id: user._id
      },
      {
        "$set": {
          lastlogin: moment().utc().format()
        }
      },{ 
        upsert: true, 
        'new': true, 
        returnOriginal:false 
      }).then(function(doc) {  
        let passwordIsValid = bcrypt.compareSync(req.body.password, user.password)
        if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })
        let token = jwt.sign({ id: user._id }, process.env.APP_SECRET, {
          expiresIn: tokenExpires
        })
        res.status(200).send({ auth: true, token: token, user: user })
      })
    })
  },
  restore_password: (req, res) => {
    req.app.db.collection('admins').findOne({
      email: req.body.email
    },function(err, account) {
      if (!account) return res.status(404).send('No account found.')
      var code = new bson.ObjectID().toString()
      req.app.db.collection('admins').findOneAndUpdate(
      {
        email: req.body.email
      },
      {
        "$set": { session_recovery_code: code }
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
            title:`Hola, ${doc.value.first_name}. Solicitaste ayuda con tu contraseña.`,
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
  change_password: (req, res) => {
    var password = req.body.password
    req.app.db.collection('admins').findOne({
      _id: new ObjectId(req.decoded.id)
    },function(err, doc) {
      if (err) return res.status(500).send('Error on the server:' + err)
      if (!doc) return res.status(404).send({ auth: false, token: null })
      if(doc.rol === 'deshabilitado') res.status(402).send({ auth: false, token: null })

      let passwordIsValid = bcrypt.compareSync(req.body.old_password, doc.password)
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })

      bcrypt.hash(req.body.new_password, saltRounds, function (err, hash) {
        req.app.db.collection('admins').findOneAndUpdate({
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
  update_password: (req, res) => {
    req.app.db.collection('admins').findOne({
      session_recovery_code: req.body.code
    },function(err, account) {
      if (!account) return res.status(404).send('No account found.')
      let password = req.body.password
      bcrypt.hash(password, saltRounds, function (err, hash) {
        req.app.db.collection('admins').findOneAndUpdate(
        {
          session_recovery_code: req.body.code
        },
        {
          "$set": { 
            password: hash,
            session_recovery_code: null 
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
              title:`Hola, ${doc.first_name}. Actualizaste tu contraseña.`,
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
  },
  dash:  (req, res) => {
    req.app.db.collection('shops').find({ enabled: true, wizard_complete: true}).toArray((err, shops) => {
      req.app.db.collection('stock').find().toArray((err, stock) => {
        req.app.db.collection('sales').find().toArray((err, sales) => {
          req.app.db.collection('events').find({
            history: {
              "$elemMatch": {
                created: {
                  "$gte": moment().subtract(req.body.days, 'days').format()
                }
              }
            }
          }).toArray((err, events) => {
            let history = []
            let salesCount = 0
            let items = stock.flatMap(e => [...e.items])

            if (sales.length) {
              salesCount = sales.reduce((acc, e) => acc + parseFloat(e.total), 0)
            }

            if (events) {
              events.forEach(e => {
                e.history.forEach(i => {
                  history.push(i)
                })
              })
            }
            return res.json({
              status: 'success',
              events: history,
              itemsCount: items.length,
              shopsCount: shops.length,
              salesCount: salesCount
            })
          })
        })
      })
    })
  },
  disapprove: (req, res) => {
    req.app.db.collection('proveedores').findOneAndUpdate(
    {
      '_id': new ObjectId(req.body._id)
    },{
      "$set" : {
        rol: 'deshabilitado',
        plan: ''
      }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return emailClient.send({
        to: doc.value.email, 
        subject: `Cuenta deshabilitada`,
        data: {
          title: `¡Lo sentimos ${doc.value.first_name}!`,
          message: '<p>Tu cuenta de proveedor fue deshabilitada temporalmente por incumplimiento de algunas de nuestras políticas de privacidad y/o términos y condiciones de uso.</p><p>En caso de considerarlo necesario, nuestro equipo de soporte se comunicará con usted para solucionarlo.</p>',
          link: process.env.APP_URL + '/como-funciona',
          linkText: 'Conocer más acerca de Festive',
          tag: 'cliente'
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
  },
  approve: (req, res) => {
    let codigo_invitacion = new bson.ObjectID().toString()
    var data = {}

    if (req.body.plan === 'free') {
      data.subject = 'Aprobación de cuenta'
      data.title = '¡Felicitaciones!'
      data.message = '¡Fuiste aprobado para formar parte de Festive! Seguí el enlace para obtener acceso a tu panel de proveedor.',
      data.link = process.env.PANEL_URL + '/registrarme/' + codigo_invitacion,
      data.linkText = 'Comenzar'
    }

    if (req.body.plan === 'premium') {
      data.subject = 'Activación de plan'
      data.title = '¡Excelentes noticias!'
      data.message = 'Ahora sos parte de nuestros clientes exclusivos. Trabajamos todos los días para llevar tu negocio a un próximo nivel y estamos orgullosos de contarte como cliente premium.',
      data.link = process.env.PANEL_URL + '/premium',
      data.linkText = 'Conocé los beneficios de plan Premium'
    }
    req.app.db.collection('proveedores').findOneAndUpdate(
    {
      '_id': new ObjectId(req.body._id)
    },{
      "$set" : {
        rol: 'proveedor',
        plan: req.body.plan || 'free',
        maileado: true,
        codigo_invitacion: codigo_invitacion
      }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return emailClient.send({
        to: doc.value.email, 
        subject: data.subject,
        data: {
          title: data.title,
          message: data.message,
          link: data.link,
          linkText: data.linkText,
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
  },
  restore_password: (req, res) => {
    var code = new bson.ObjectID().toString()
    req.app.db.collection('admins').findOneAndUpdate(
    {
      email: req.body.email
    },
    {
      "$set": { session_recovery_code: code }
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
          title:`Hola, ${doc.first_name}. Solicitaste ayuda con tu contraseña.`,
          message:`Alguien solicitó una restauración de constraseña. Si no fuiste vos quien la solicitó podés ignorar este mensaje. `,
          link: process.env.PANEL_URL + '/actualizar-contrasena/' + code,
          linkText:'Actualizar mi contraseña ahora',
          tag: 'proveedor'
        },
        templatePath:path.join(__dirname,'/../email/template.html')
      })
    })
  },
  update_password: (req, res) => {
    let password = req.body.password
    bcrypt.hash(password, saltRounds, function (err, hash) {
      req.app.db.collection('admins').findOneAndUpdate(
      {
        session_recovery_code: req.body.session_recovery_code
      },
      {
        "$set": { 
          password: hash,
          session_recovery_code: null 
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
            title:`Hola, ${doc.first_name}. Actualizaste tu contraseña.`,
            message:`El proceso de recuperación de cuenta se completó con éxito. Ya podés iniciar sesión con tu nueva contraseña.`,
            link: process.env.PANEL_URL + '/iniciar-sesion',
            linkText:'Iniciar sesión ahora',
            tag: 'proveedor'
          },
          templatePath:path.join(__dirname,'/../email/template.html')
        })
      })
    })
  },
  restore_password: (req, res) => {
    req.app.db.collection('admins').findOne({
      email: req.body.email,
      rol: 'proveedor'
    },function(err, account) {
      if (!account) return res.status(404).send('No account found.')
      var code = new bson.ObjectID().toString()
      req.app.db.collection('admins').findOneAndUpdate(
      {
        email: req.body.email,
        rol: 'proveedor'
      },
      {
        "$set": { session_recovery_code: code }
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
            title:`Hola, ${doc.value.first_name}. Solicitaste ayuda con tu contraseña.`,
            message:`Alguien solicitó una restauración de constraseña. Si no fuiste vos quien la solicitó podés ignorar este mensaje. `,
            link: process.env.ADMIN_URL + '/actualizar-contrasena/' + code,
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
  change_password: (req, res) => {
    var password = req.body.password
    req.app.db.collection('admins').findOne({
      _id: new ObjectId(req.decoded.id)
    },function(err, doc) {
      if (err) return res.status(500).send('Error on the server:' + err)
      if (!doc) return res.status(404).send({ auth: false, token: null })

      let passwordIsValid = bcrypt.compareSync(req.body.password_current, doc.password)
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })

      bcrypt.hash(req.body.new_password, saltRounds, function (err, hash) {
        req.app.db.collection('admins').findOneAndUpdate({
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
  update_password: (req, res) => {
    req.app.db.collection('admins').findOne({
      session_recovery_code: req.body.code
    },function(err, account) {
      if (!account) return res.status(404).send('No account found.')
      let password = req.body.password
      bcrypt.hash(password, saltRounds, function (err, hash) {
        req.app.db.collection('admins').findOneAndUpdate(
        {
          session_recovery_code: req.body.code
        },
        {
          "$set": { 
            password: hash,
            session_recovery_code: null 
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
              title:`Hola, ${doc.first_name}. Actualizaste tu contraseña.`,
              message:`El proceso de recuperación de cuenta se completó con éxito. Ya podés iniciar sesión con tu nueva contraseña.`,
              link: process.env.ADMIN_URL + '/iniciar-sesion',
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
  },
  create_account: (req, res) => {
    let password = new bson.ObjectID().toString()
    bcrypt.hash(password, saltRounds, function (err, hash) {
      req.body.password = hash
      req.body.registration_date = new Date()
      req.body.created = new Date()
      req.app.db.collection('admins').insertOne(req.body, function (err, results) {
        if(err) {
          res.status(200).send({ status: 'error: ' + err })
        } else {
          return emailClient.send({
            to: req.body.email,
            subject: 'Nueva cuenta administración',
            data: {
              title:`Hola, ${req.body.first_name}. Una cuenta fue creada para vos.`,
              message:`
                <p>A continuación los datos de acceso<p>
                <p>
                  <span>Usuario: ${req.body.email}</span><br>
                  <span>Contraseña: ${password}</span>
                </p>`,
              link: process.env.ADMIN_URL + '/login',
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
        }
      })
    })
  },
  search: (req, res) => {
    var results = []
    var all = req.app.db.listCollections().toArray((err, cols) => {
      cols.map((e, i) => {
        req.app.db.collection(e.name).find({ 
          $or: [
            { first_name: { "$regex": req.body.query, '$options' : 'i' }},
            { contenido: { "$regex": req.body.query, '$options' : 'i' }}
          ]
        }).toArray((err,docs) => {
          if (docs.length) {
            results.push({ 
              name: e.name,
              data: docs
            })
          }
          if (i === cols.length - 1) {
            return res.json(results)    
          }
        })
      })
    })    
  }
}
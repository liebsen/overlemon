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
  dash:  (req, res) => {
    req.app.db.collection('stock').find({
      shop: req.decoded.id
    }).toArray((err, stock) => {
      req.app.db.collection('sales').find({
        shop: req.decoded.id
      }).toArray((err, sales) => {
        req.app.db.collection('events').find({
          shop: req.decoded.id,
          history: {
            "$elemMatch": {
              created: {
                '$gte': moment().subtract(req.body.days, 'days').format()
              }
            }
          }
        }).toArray((err, events) => {
          const items = stock.flatMap(e => [...e.items])
          const salesCount = sales.reduce((acc, e) => acc + parseFloat(e.total), 0)
          let history = {}
          if (events[0]) {
            if (events[0].history) {
              history = events[0].history
            }
          }
          return res.json({
            status: 'success',
            events: history,
            itemsCount: items.length,
            salesCount: salesCount
          })
        })
      })
    })
  },
  token:  (req, res) => {
    req.app.db.collection('shops').find({
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
    if (!req.body.emailorid || !req.body.password) {
      return res.status(402).send({ auth: false, token: null })
    }
    var emailorid = req.body.emailorid.toLowerCase()
    var password = req.body.password
    req.app.db.collection('shops').findOne({
      $or: [
        { email: emailorid },
        { id: emailorid }
      ]
    },function(err, shop) {
      if (err) return res.status(500).send('Error on the server.')
      if (!shop) return res.status(404).send('No shop found.')
      if (!shop.enabled) return res.status(402).send({ auth: false, token: null })
      let passwordIsValid = bcrypt.compareSync(req.body.password, shop.password)
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })

      // update lastlogin
      req.app.db.collection('shops').findOneAndUpdate({
        _id: shop._id
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
        let token = jwt.sign({ id: shop._id }, process.env.APP_SECRET, {
          expiresIn: tokenExpires
        })
        res.status(200).send({ auth: true, token: token, shop: shop })
      })
    })
  },
  restore_password: (req, res) => {
    const code = new bson.ObjectID().toString()
    req.body.email = req.body.email.toLowerCase().trim()    
    req.app.db.collection('shops').findOneAndUpdate(
    {
      $or: [
        { email: req.body.email },
        { id: req.body.email }
      ]
    },
    {
      "$set": { session_recovery_code: code }
    },
    { 
      upsert: false, 
      'new': false,
      returnOriginal: true
    }).then(function(doc) {
      const shop = doc.value
      console.log(shop)
      if (!shop) {
        return res.json({
          status: 'error',
          message: 'No se encontró la tienda'
        })
      }
      return emailClient.send({
        to: shop.email,
        subject: 'Restaurar contraseña',
        data: {
          title: `Hola, ${shop.first_name}. Solicitaste ayuda con tu contraseña.`,
          message: `Alguien solicitó una restauración de constraseña. Si no fuiste vos quien la solicitó podés ignorar este mensaje. `,
          link: process.env.PANEL_URL + '/recuperar-sesion/' + code,
          linkText: 'Actualizar mi contraseña',
          tag: 'proveedor'
        },
        templatePath:path.join(__dirname,'/../email/template.html')
      }).then(function(){
        res.json({
          status: 'success',
          message: 'Se envió un correo a tu cuenta con instrucciones'
        })
      }).catch(function(err){
        if(err) console.log(err)
        res.json({
          status: 'error',
          message: 'error: ' + err
        })
      })
    })
  },
  update_password: (req, res) => {
    bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
      req.app.db.collection('shops').findOneAndUpdate(
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
        upsert: false, 
        'new': false,
        returnOriginal: true
      }).then(function(doc){
        const shop = doc.value

        if (!shop) {
          return res.status(404).send('No account found.')
        }

        return emailClient.send({
          to: shop.email,
          subject: 'Contraseña actualizada',
          data: {
            title:`Hola, ${shop.first_name}. Actualizaste tu contraseña.`,
            message:`El proceso de recuperación de cuenta se completó con éxito. Ya podés iniciar sesión con tu nueva contraseña.`,
            link: process.env.PANEL_URL,
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
  },
  change_password: (req, res) => {
    var password = req.body.password
    req.app.db.collection('shops').findOne({
      _id: new ObjectId(req.decoded.id)
    },function(err, doc) {
      if (err) return res.status(500).send('Error on the server:' + err)
      if (!doc) return res.status(404).send({ auth: false, token: null })
      if(doc.rol === 'deshabilitado') res.status(402).send({ auth: false, token: null })

      let passwordIsValid = bcrypt.compareSync(req.body.old_password, doc.password)
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })

      bcrypt.hash(req.body.new_password, saltRounds, function (err, hash) {
        req.app.db.collection('shops').findOneAndUpdate({
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
  create: (req, res) => {
    var password = req.body.password
    var validation_code = new bson.ObjectID().toString()
    req.app.db.collection('shops').countDocuments({
      email: req.body.email
    }, {}, (err, count) => {
      if (count) {
        return res.json({
          status: 'danger',
          message: `Ya existe una geotienda registrada con el email <strong>${req.body.email}</strong>. Si olvidaste tu contraseña presioná en el botón Me olvidé la clave.`
        })
      }

      bcrypt.hash(password, saltRounds, function (err, hash) {
        req.app.db.collection('shops').findOneAndUpdate({
          referer: req.body.code,
          password: null,
        },
        {
          "$set": {
            id: req.body.id,
            shop: req.body.shop,
            first_name: req.body.first_name,
            last_name: req.body.last_name,
            email: req.body.email,
            password: hash,
            validated: false,
            enabled: true,
            validation_code: validation_code,
            wizard_complete: false,
            wizard_complete_date: null,
            created: moment().format(),
            plan: null,
            trial: true,
            trial_ends: moment().add(1, 'months').format()            
          }
        },{ 
          upsert: true, 
          'new': true, 
          returnOriginal:false 
        }).then(function(doc) {   
          return emailClient.send({
            to: doc.value.email,
            subject: 'Validación de cuenta',
            data: {
              title: `Hola ${doc.value.shop}, te damos la bienvenida a Geotiendas`,
              message: `Estamos muy contentos de contar con vos, trabajaremos juntos para llevar tu negocio a un siguiente nivel. Tenés un mes para evaluar nuestra plataforma sin compromiso de suscripción, luego de este periodo tenés un mes más para reclamar tu tienda y en caso de que no te suscribas no podemos garantizar la permanencia de los eventual infomración que hayas cargado. Podés leer nuestros <a href="https://geotiendas.com/terminos-y-condiciones">términos y condiciones</a> para saber más.
<br><br>
<h4>Datos de tu tienda</h4>
<pre>
Nombre de tu tienda: ${doc.value.shop}
Enlace a tu tienda: <a href="https://${doc.value.id}.geotiendas.com">https://${doc.value.id}.geotiendas.com</a>
</pre>
<br>
<h4>Datos de acceso a tu panel</h4>
<pre>
Usuario: ${doc.value.email}
Contraseña: ${password}
</pre>
<h4>Tu periodo de prueba caduca</h4>
<pre>
${doc.value.trial_ends}
</pre>
<br>Para empezar a vender con tu tienda te pedimos que vayas al asistente de configuración presionando el siguiente botón. No será necesario que inicies sesión.
<br><br>
Esperamos que tengas una excelente experiencia trabajando junto a nosotros y esperamos tus comentarios.<br>`,
              link: process.env.PANEL_URL + '/validar/' + validation_code,
              linkText: 'Comenzar ahora',
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
    })
  },
  validate: (req, res) => {
    req.app.db.collection('shops').findOneAndUpdate({
      validation_code: req.body.code
    },
    {
      "$set": {
        validated: true,
        validation_date: moment().utc().format()
      }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal: false 
    }).then(function(shop) {  
      let token = jwt.sign(shop, process.env.APP_SECRET, {
        expiresIn: tokenExpires
      })
      res.status(200).send({
        auth: true,
        token: token,
        shop: shop.value
      });
    }).catch(function(err){
      if(err) return res.status(500).send("There was a problem getting user " + err)
    })
  },
  basic: (req, res) => {
    req.app.db.collection('settings').findOne({},function(err, settings) {
      req.app.db.collection('shops').findOne({
        id: req.params.shop
      }, (err, shop) => {
        if (!shop) {
          return res.json({ status: 'error', message: 'No existe tal geotienda' })
        }
        req.app.db.collection('stock').find({
          shop: shop._id.toString(),
          active: true
        }).toArray((err, stock) => {
          let items = stock.flatMap(e => {
            e.items = e.items.filter(i => i.active).map(i => {
              i.pid = e._id
              i.pname = e.name
              i.color = e.hexcolor
              return i
            })
            return [...e.items]
          })
          return res.json({
            loaded: true,
            settings: settings,
            shop: shop,
            items: items,
            stock: stock
          })
        })
      })
    })
  },
  advanced: (req, res) => {
    req.app.db.collection('shops').findOne({
      id: req.params.shop
    }, (err, shop) => {
      if (err) {
        return res.status(200).send({ status: 'error: ' + err })
      }
      if (shop) {
        delete shop.password
      }
      return res.json({
        data: shop
      })
    })
  },
  sale: (req, res) => {
    req.app.db.collection('sales').findOneAndUpdate(
    {
      '_id': new ObjectId(req.params.id)
    },{
      "$inc": {
        public_record_seen: 1
      }
    },{
      upsert: false,
      update: true
    }).then(function(doc) {
      return res.json(doc.value)
    })

    /* req.app.db.collection('sales').findOne({
      _id : new ObjectId(req.params.id)
    }, (err, sale) => {
      if (!err) {
        req.app.db.collection('sales').findOneAndUpdate(
        {
          '_id': new ObjectId(req.params.id)
        },{
          "$inc": {
            public_record_seen: 1
          }
        })
      } 
      return res.json(sale)
    }) */
  },
  contact: (req, res) => {
    req.body.created = new Date()
    req.app.db.collection('contacts').insertOne(req.body, function (err, results) {
      if(err) {
        res.status(200).send({ status: 'error: ' + err })
      } else {
        return emailClient.send({
          to: process.env.EMAIL_SMTP_USER,
          subject: `Nuevo contacto desde ${req.body.origen}`,
          data: {
            title:`Hola, ${req.body.name} tiene una consulta desde <strong>${req.body.origen}</strong>.`,
            message:`
              <p>
                <span>Nombre: ${req.body.name}</span><br>
                <span>Teléfono: ${req.body.telefono}</span><br>
                <span>Email: ${req.body.email}</span><br>
                <span>Empresa: ${req.body.empresa}</span><br>
                <span>Website: ${req.body.website}</span><br>
                <span>Consulta: ${req.body.consulta}</span>
              </p>`,
            link: `mailto:${req.body.email}`,
            linkText: `Responder a ${req.body.name}`,
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
  },
  request: (req, res) => {
    req.body.created = new Date
    req.body._id = new ObjectId().toString()
    if (req.params.id) {
      req.app.db.collection('shops').findOneAndUpdate(
      {
        _id : new ObjectId(req.params.id)
      },
      {
        "$push" : { 'consultas' : req.body }
      },
      { 
        upsert: true, 
        'new': true, 
        returnOriginal:false 
      }).then(function(doc){
        return emailClient.send({
          to:doc.value.email,
          subject: doc.value.empresa + ', tenés una nueva solicitud de presupuesto',
          data:{
            title:`Hola ${doc.value.empresa}. Solicitaron presupuesto de forma directa`,
            message:`
              <figure>
                <blockquote>${req.body.mensaje}</blockquote>
                <figcaption><strong>${req.body.name}</strong></figcaption>
              </figure>
              <p>
                <span><a style="color:#CBAAC7" href="tel:${req.body.telefono}">${req.body.telefono}</a></span><br>
                <span><a style="color:#CBAAC7" href="mailto:${req.body.email}">${req.body.email}</a></span>
              </p>`,
            link: process.env.PANEL_URL + '/solicitudes',
            linkText:'Ver mis solicitudes',
            tag: 'proveedor'
          },
          templatePath:path.join(__dirname,'/../email/template.html')
        }).catch(function(err){
          if(err) console.log(err)
        }).then(function(){
          res.status(200).send({ status: 'success' });
        })
      }).catch(function(err){
        if(err){
          return res.json({
            status: 'error: ' + err
          })
        }
      })
    } else {
      req.body._id = new ObjectId()
      req.app.db.collection('presupuestos').insertOne(req.body, function (error, response) {
        if(error) {
          console.log('Error occurred while inserting');
        } else {
          res.status(200).send({ status: 'success' });
        }
      })
    }
  },
  searchall: (req, res) => {
    req.app.db.collection('stock').find({
      shop: req.decoded.id,
      $or: [
        {'items.name': { "$regex": req.body.query, '$options' : 'i' }},
        {'items.text': { "$regex": req.body.query, '$options' : 'i' }}
      ]
    }).toArray((err,docs) => {
      return res.json(docs || [])
    })
  },
  blog: {
    listing: (req, res) => {
      req.app.db.collection('blog').find().toArray((err,docs) => {
        return res.json(docs)
      })
    },
    category: (req, res) => {
      req.app.db.collection('blog').find({
        slug: req.params.slug.toString()
      }).toArray((err,docs) => {
        return res.json(docs[0])
      })
    },
    entry: (req, res) => {
      req.app.db.collection('blog').aggregate(
      { $match : {
        slug: req.params.slug.toString(),
        'entries.slug': req.params.sslug
      }},
      { $unwind : "$entries"},
      { $match : {
        slug: req.params.slug.toString(),
        'entries.slug': req.params.sslug
      }},{ $group: { "entries.slug": req.params.sslug, count: { $sum: 1 } } })
      .toArray(function(err,results){
        return res.json(results[0])
      })  
    },
    search: (req, res) => {
      req.app.db.collection('blog').find({
        $or: [
          {'entries.name': { "$regex": req.body.query, '$options' : 'i' }},
          {'entries.content': { "$regex": req.body.query, '$options' : 'i' }}
        ]
      }).toArray((err,docs) => {
        return res.json(docs || [])
      })
    }
  }
}
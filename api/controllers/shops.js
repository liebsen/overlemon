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
const geolib = require('geolib')
const reservedNames = 'geotiendas api app panel chat web assets share feria tiendas gestor admin cuenta cuentas comunidad pagos checkout object developers partners administrador ayuda gestion status'
const zeroPad = (num, places) => String(num).padStart(places, '0')

module.exports = {
  token: (req, res) => {
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
    req.app.db.collection('shops').findOne({
      email: req.body.email,
      rol: 'proveedor'
    },function(err, account) {
      if (!account) return res.status(404).send('No account found.')
      var code = new bson.ObjectID().toString()
      req.app.db.collection('shops').findOneAndUpdate(
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
  update_password: (req, res) => {
    req.app.db.collection('shops').findOne({
      session_recovery_code: req.body.code,
      rol: 'proveedor'
    },function(err, account) {
      if (!account) return res.status(404).send('No account found.')
      let password = req.body.password
      bcrypt.hash(password, saltRounds, function (err, hash) {
        req.app.db.collection('shops').findOneAndUpdate(
        {
          session_recovery_code: req.body.code,
          rol: 'proveedor'
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
  },
  create: (req, res) => {
    if (!req.body || !req.body.id) {
      return res.status(402).send({ status: 'error', message: 'This method does not allow automated or manual interaction. Please use the application. Thanks' })
    }
    var password = req.body.password
    var validation_code = new bson.ObjectID().toString()
    let currency = 'ARS'
    req.app.db.collection('shops').countDocuments({
      email: req.body.email
    }, {}, (err, count) => {
      if (count) {
        return res.json({
          status: 'danger',
          message: `Ya existe una geotienda registrada con el email <span class="has-text-warning">${req.body.email}</span>. Si olvidaste tu contraseña presioná en el botón <span class="has-text-warning">Olvidé mi contraseña<span>.`
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
            enabled: true,
            shop: req.body.shop,
            first_name: req.body.first_name,
            last_name: req.body.last_name,
            scope: 'country',
            type: 'products',
            item_layout: 'landscape',
            background: 'https://cdn.geotiendas.com/img/background.jpg',
            logo: 'https://cdn.geotiendas.com/img/logo.jpg',
            country: req.body.country,
            country_iso: req.body.country_iso,
            email: req.body.email,
            password: hash,
            currency: currency,
            validated: false,            
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
              title: `Hola ${doc.value.shop}, te damos la bienvenida a Geotiendas, seguí el enlace al final de este email para comenzar.`,
              message: `Estamos muy contentos de contar con vos, mi nombre es Marcia y soy la encargada del área de soporte de la plataforma. Este es un email importante con información sensible de tu cuenta que podés guardar para cuando lo necesites.
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
<br>Para empezar a vender con tu tienda te pedimos que vayas al asistente de configuración presionando el siguiente botón. No será necesario que inicies sesión.
<br><br>
Gracias por confiar en nosotros y te damos la bienvenida a esta hermosa comunidad de emprendedores que cada día crece más.<br>`,
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
  calc_shipping: (req, res) => {
    if (!req.body.destination) {
      return res.json({ status: 'error', message: 'Se necesitan coordenadas de destino' })
    }
    req.app.db.collection('shops').findOne({
      _id: new ObjectId(req.params.shop)
    }, (err, shop) => {
      if (shop.scope !== 'country' || !shop.geo) {
        return res.json({ status: 'error', message: 'Esta geotienda solo acepta envíos locales' })
      }

      const distanceMts = geolib.getDistance({
        latitude: shop.geo.lat,
        longitude: shop.geo.lng
      },{
        latitude: req.body.destination.lat,
        longitude: req.body.destination.lng
      })

      const distanceKm = geolib.convertDistance(distanceMts, 'km')
      const distanceCost = parseFloat(distanceKm * shop.cost_delivery_km)
      const baseCost = parseFloat(shop.cost_delivery_base)
      
      return res.json({ status: 'success', cost: parseInt(distanceCost + baseCost), distanceKm: distanceKm })
    })
  },
  checkname: (req, res) => {
    if (reservedNames.split(' ').includes(req.body.id)) {
      return res.json({
        status: 'danger',
        message: `El nombre de usuario ${req.body.id} está reservado para el uso interno de geotiendas y no se puede utilizar. Por favor, elegí otro.`
      })
    }
    req.app.db.collection('shops').countDocuments({
      id: req.body.id
    }, {}, (err, count) => {
      let status = 'success'
      let message = `La tienda ${req.body.id} está diponible`
      if (count) {
        status = 'danger'
        message = `Ya existe una tienda ${req.body.id} y no se puede usar. Por favor, elegí otro.`
      }
      return res.json({
        status: status,
        message: message
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
    if (req.params.shop === '192') {
      req.params.shop = 'localhost'
    }
    req.app.db.collection('shops').findOne({
      id: req.params.shop
    }, (err, shop) => {
      if (!shop) {
        return res.json({
          id: req.params.shop
        })
      }

      if (shop.bank_cbu) {
        delete shop.bank_cbu
      }
      if (shop.mp_access_token) {
        delete shop.mp_access_token
      }
      if (shop.password) {
        delete shop.password
      }

      req.app.db.collection('stock').find({
        shop: shop._id.toString(),
        active: true
      }).toArray((err, stock) => {
        let items = stock.flatMap(e => {
          e.items = e.items.filter(i => i.active).map(i => {
            i.pid = e._id
            i.pname = e.name
            return i
          })
          return [...e.items]
        })
        shop.items = items
        shop.stock = stock
        return res.json(shop)
      })
    })
  },
  advanced: (req, res) => {
    req.app.db.collection('shops').findOne({
      id: req.params.shop
    }, (err, shop) => {
      delete shop.password
      return res.json({
        data: shop
      })
    })
  },
  sale: (req, res) => {
    req.app.db.collection('sales').findOneAndUpdate(
    {
      '_id': new ObjectId(req.params.sale)
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
            title:`Hola, ${req.body.name} tiene una consulta desde <span class="has-text-sarning">${req.body.origen}</span>.`,
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
                <figcaption><span class="has-text-sarning">${req.body.name}</span></figcaption>
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
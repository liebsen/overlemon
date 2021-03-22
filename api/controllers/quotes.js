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
const reservedNames = 'geotiendas api app panel chat web assets share feria tiendas gestor admin cuenta cuentas comunidad pagos checkout object developers personas administrador ayuda gestion status'
const zeroPad = (num, places) => String(num).padStart(places, '0')

module.exports = {
  quote: (req, res) => {
    req.app.db.collection('quotes').findOne({ 
      _id: new ObjectId(req.params.quote)
    }, (err, quote) => {
      if (err) {
        return res.status(200).send({ status: 'error', message:  'error: ' + err })
      }
      if (!quote) {
        return res.status(200).send({ status: 'error', message:  'No such customer' })
      }
      res.json({ staus: 'success', data: quote })
    })
  },
  create: (req, res) => {
    // Crea una cotización
    let quote = req.body

    if (!quote || !Object.keys(quote).length) {
      return res.json({ status: 'error', message: 'Tu orden está vacía'})
    }
  
    req.app.db.collection('shops').findOne({ 
      _id: new ObjectId(req.params.shop)
    }, (err, shop) => {
      if (err) {
        return res.status(200).send({ status: 'error', message:  'error: ' + err })
      }
      if (!shop) {
        return res.status(200).send({ status: 'error', message:  'No such customer' })
      }

      const item = quote.order[0]
      const shop_url = `https://${shop.id}.geotiendas.com`
      quote.subject = `Solicitud de cotización en ${shop.shop}`
      quote.description = `Cotización de servicio ${item.name} en ${shop.shop}`
      quote.currency = 'ARS'
      quote.quantity = 1
      quote.total = 0
      quote.created = new Date()
      quote.shop = shop._id.toString()
      
      req.app.db.collection('quotes').countDocuments({
        shop: shop._id.toString()
      }, {}, (err, count) => {
        if (err) console.log('err: ' + err)
        quote.id = zeroPad(count + 1, 6)
        req.app.db.collection('quotes').insertOne(quote, function (err, response) {
          if(err) {
            return res.status(200).send({ status: 'error', message:  'error: ' + err })
          }
          let result = response.ops[0]

          /* mail to asker */
          emailClient.send({
            to: quote.customer.email,
            subject: `[${shop.shop}] Solicitud de cotización`,
            data:{
              title: 'Recibimos tu solicitud de cotización',
              message: `En ${shop.shop} estarán evaluando tu propuesta, si la descripción de la solicitud es suficiente te llegará la cotización por este medio. De lo contrario es muy probable que desde ${shop.shop} se comuniquen con vos por email o por teléfono.<br><br>Gracias por visitar Geotiendas.`,
              link: `${shop_url}`,
              linkText: `Seguir comprando en ${shop.shop}`,
              tag: 'proveedor'
            },
            templatePath: path.join(__dirname,'/../email/template.html')
          }).catch(function(err){
            if(err) console.log(`email error: ${err}`)                
          })

          /* mail to customer */
          emailClient.send({
            to: shop.email,
            subject: `[${shop.shop}] Presupuesto`,
            data:{
              title: 'Nueva solicitud de cotización',
              message: `Hola ${shop.first_name}, registramos una solicitud de cotización en tu geotienda ${shop.shop}. <br>El número de la cotización es <pre>${quote.id}</pre>`,
              link: `https://gestor.geotiendas.com/presupuestos/` + result._id.toString(),
              linkText: `Ver cotización`,
              tag: 'proveedor'
            },
            templatePath: path.join(__dirname,'/../email/template.html')
          }).catch(function(err){
            if(err) console.log(`email error: ${err}`)                
          })

          return res.json({ status: 'success', data: result })
        })
      })
    })
  },
  reply: (req, res) => {
    let reply = req.body

    if (!reply || !Object.keys(reply).length) {
      return res.json({ status: 'error', message: 'Tu respuesta está vacía'})
    }
    req.app.db.collection('quotes').findOneAndUpdate(
    {
      _id: new ObjectId(req.params.quote)
    },{
      "$set" : {
        sent: true,
        text: req.body.text,
        total: req.body.total
      }
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      let quote = doc.value

      if (!quote) {
        return res.status(200).send({ status: 'error', message:  'No such quote' })
      }

      req.app.db.collection('shops').findOne({ 
        _id: new ObjectId(quote.shop)
      }, (err, shop) => {

        const shop_url = `https://${shop.id}.geotiendas.com`

        if (err) {
          return res.status(200).send({ status: 'error', message:  'error: ' + err })
        }
        if (!shop) {
          return res.status(200).send({ status: 'error', message:  'No such shop' })
        }

        /* mail to customer */
        return emailClient.send({
          to: quote.customer.email,
          subject: `[${shop.shop}] Cotización`,
          data:{
            title: `[${shop.shop}] Cotización`,
            message: `Hola ${quote.customer.fullname}, En ${shop.shop} constestaron a tu solicitud de cotización. <br>Esto es lo que dicen: <pre>
Comentarios: ${quote.text}
Costo: $${quote.total}
</pre>
<br>Si querés comunicarte de forma directa con ${shop.shop} podés hacerlo a través de estas vías:<br>
<pre>
Email: ${shop.email}
Teléfono: ${shop.phone}
</pre>
<br>Desde Geotiendas esperamos que puedan llegar al mejor acuerdo posible y realizar el intercambio de forma favorable para ambas partes.`,
            link: `${shop_url}/cotizaciones/` + quote._id.toString(),
            linkText: `Pagar ${quote.order[0].name}`,
            tag: 'proveedor'
          },
          templatePath: path.join(__dirname,'/../email/template.html')
        }).then(function(){
          res.json({
            status: 'success',
            message: `La Cotización fue enviado con éxito a ${quote.customer.email}`
          })
        }).catch(function(err){
          if(err) console.log(`email error: ${err}`)                
        })
      })
    })
  }
}

const path = require("path")
const mercadopago = require ('mercadopago')
const axios = require('axios')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const moment = require('moment')
const ObjectId = require('mongodb').ObjectId
const zeroPad = (num, places) => String(num).padStart(places, '0')

mercadopago.configure({
  //sandbox: true,
  access_token: process.env.MP_TOKEN
})

module.exports = {
  create: (req, res, next) => {
    // Crea una venta
    const paymode = req.body.paymode
    const valid_modes = ['bank', 'mercadopago']
    let subscription = {}

    if (!valid_modes.includes(paymode)) {
      return res.json({ status: 'error', message: 'Método de pago inválido'})
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

      subscription.plan = req.body.plan
      subscription.subject = `Suscripción a plan ${req.body.item.title} en Geotiendas`
      subscription.description = `Adquisición de plan ${req.body.item.title} en Geotiendas`
      subscription.currency = 'ARS'
      subscription.quantity = 1
      subscription.created = new Date()
      subscription.customer = {}
      const copyShop = ['shop', 'id', 'first_name', 'last_name', 'created', 'phone', 'email', 'plan', 'text', 'type', 'address', 'address_extra']
      /* copy some data from shop */
      copyShop.forEach(e => {
        subscription.customer[e] = shop[e]
      })

      req.app.db.collection('landing').findOne({}, (err, landing) => {
        if (err || !landing.plans[req.body.plan]) {
          return res.status(200).send({ status: 'error', message:  'No such plan' })
        }

        const item = landing.plans[req.body.plan]
        let total = parseFloat(item.price)
        let expires = moment(shop.plan_expires).add(1, 'months').format()

        if (req.body.period === 'semestral') {
          expires = moment(shop.plan_expires).add(6, 'months').format()
          total *= 6
          total *= 1 - (parseFloat(item.biannual_discount) / 100)
        } else if (req.body.period === 'anual') {
          expires = moment(shop.plan_expires).add(1, 'years').format()
          total *= 12
          total *= 1 - (parseFloat(item.annual_discount) / 100)
        }

        subscription.shop = shop._id.toString()
        subscription.total = total
        subscription.period = req.body.period
        subscription.expires = expires
        subscription.plan = req.body.plan
        subscription.payment_mode = paymode
        subscription.payment_mode = paymode
        subscription.payment_complete = false
        
        req.app.db.collection('subscriptions').countDocuments({}, {}, (err, count) => {
          if (err) console.log('err: ' + err)
          subscription.id = zeroPad(count + 1, 6)
          req.app.db.collection('subscriptions').insertOne(subscription, function (err, response) {
            if(err) {
              return res.status(200).send({ status: 'error', message:  'error: ' + err })
            }
            let result = response.ops[0]
            if (paymode === 'mercadopago') {
              let preference = {
                items: [
                  {
                    id: result._id.toString(),
                    title: result.subject,
                    description: result.description,
                    unit_price: result.total,
                    currency_id: result.currency,
                    quantity: result.quantity
                  }
                ],
                back_urls: {
                  success: `${process.env.PANEL_URL}/pago-procesado/exito`,
                  failure: `${process.env.PANEL_URL}/pago-procesado/error`,
                  pending: `${process.env.PANEL_URL}/pago-procesado/pendiente`
                },
                notification_url: 'https://' + req.get('host') + "/panel/payments/mercadopago/notification",
                external_reference: result._id.toString()
              }
              mercadopago.preferences.create(preference).then(function(response) {
                /* mail to buyer */
                emailClient.send({
                  to: shop.email,
                  subject: `[Geotiendas] Registramos tu suscripción`,
                  data:{
                    title: 'Registramos tu suscripción',
                    message: `Hola ${shop.first_name}, recibimos tu suscripción en Geotiendas. Elegiste como método de pago ONLINE. En caso de que no puedas efectivizar el pago ponete en contacto con nosotros para efectivizarlo a través de transferencia por CBU.<br><br>Tu número de suscripción es<pre>${subscription.id}</pre><br>Muchas gracias por tu suscripción.`,
                    link: `${process.env.PANEL_URL}/suscripciones/` + result._id.toString(),
                    linkText: `Tu suscripción en Geotiendas`,
                    tag: 'proveedor'
                  },
                  templatePath: path.join(__dirname,'/../email/template.html')
                }).catch(function(err){
                  if(err) console.log(`email error: ${err}`)                
                })

                return res.json({ status: 'success', data: response.body })
              }).catch(function(err){
                if (err) console.log(`mercadopago error: ${err}`);
                return res.json({ status: 'error', message: `mercadopago error:${error}` })
              })
            } else {

              /* bank cbu */
              req.app.db.collection('settings').findOne({}, (err, settings) => {
                if (err || !settings) {
                  return res.status(200).send({ status: 'error', message:  'No settings for bank cbu' })
                }

                let message = `Hola ${shop.first_name}, recibimos tu suscripción en Geotiendas.`
                if (paymode === 'bank') {
                  message+= `Elegiste como método de pago CBU. Ponemos a tu disposición los datos para hacer efectiva la adquisición de tu plan en Geotiendas<br>------------------------------------<br><pre>
Entidad: ${settings.bank_entity}
Titular: ${settings.bank_owner}
CBU: ${settings.bank_cbu}
Alias: ${settings.bank_alias}
Cuenta: ${settings.bank_account}
</pre><br>------------------------------------<br><br>Por favor indicanos el Número de Pedido en los datos adicionales de la transferencia así podemos identificar tu pago más fácilmente.`
                }

                message+= `<br>Tu número de suscripción es<pre>${subscription.id}</pre><br>Muchas gracias por tu suscripción.`

                /* mail to buyer */
                emailClient.send({
                  to: shop.email,
                  subject: 'Recibimos tu suscripción',
                  data:{
                    title: 'Recibimos tu suscripción',
                    message: message,
                    link: `${process.env.PANEL_URL}/suscripciones/` + result._id.toString(),
                    linkText: `Tu suscripción en Geotiendas`,
                    tag: 'proveedor'
                  },
                  templatePath: path.join(__dirname,'/../email/template.html')
                }).catch(function(err){
                  if(err) console.log(`email error: ${err}`)                
                })

                return res.json({ status: 'success', data: result })
              })
            }
          })
        })
      })
    })
  },
  notification: (req, res) => {
    if (req.body.data) {
      return axios.get('https://api.mercadopago.com/v1/payments/' + req.body.data.id + '?access_token=' + process.env.MP_TOKEN, {} ).then((response) => {
        if (response.data.status === 'approved') {
          return req.app.db.collection('subscriptions').findOneAndUpdate(
          {
            '_id': new ObjectId(response.data.external_reference)
          },
          {
            "$set": {
              payment_complete: true,
              mercadopago: response.data
            }
          },{ 
            upsert: false,
            update: true,
            returnOriginal: false 
          }).then(function(doc) {

            if (!doc.value) {
              res.sendStatus(400)
            }

            req.app.db.collection('shops').findOneAndUpdate({
              _id: new ObjectId(doc.value.shop)
            },          {
              "$set": {
                plan: doc.value.plan,
                plan_expires: doc.value.expires
              }
            },{ 
              upsert: false,
              update: true,
              returnOriginal: false 
            }).then(function(shop) {

              if (err || !shop) {
                res.sendStatus(400)
              }

              req.app.io.to('geotiendas').emit('mercadopago', doc.value)

              return emailClient.send({
                to: doc.value.customer.email,
                subject: '[Geotiendas] Recibimos tu pago',
                data:{
                  title: 'Recibimos tu pago',
                  message: `Hola ${shop.value.first_name}, recibimos tu pago en Geotiendas.<br>Muchas gracias por tu suscripción.`,
                  link: `${process.env.PANEL_URL}/ventas/${doc.value._id}`,
                  linkText: 'Tu orden de suscripción en Geotiendas',
                  tag: 'proveedor'
                },
                templatePath:path.join(__dirname,'/../email/template.html')
              }).then(function(){
                res.sendStatus(200)
              }).catch(function(err){
                if(err) console.log(err)
                res.sendStatus(200)
              })
            })
          }).catch((err) => {
            return res.json(err)
          })
        }
      }).catch((err) => {
        return res.json(err)
      })
    } else {
     res.sendStatus(200)
    }
  },
  procesar_pago: (req, res) => { 
    res.redirect(process.env.APP_URL + '/pago-procesado/' + req.body.payment_status)
  }
}
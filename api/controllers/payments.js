const path = require("path")
const mercadopago = require ('mercadopago')
const axios = require('axios')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const moment = require('moment')
const ObjectId = require('mongodb').ObjectId
const geolib = require('geolib')
const zeroPad = (num, places) => String(num).padStart(places, '0')

module.exports = {
  create: (req, res, next) => {
    // Crea una venta
    const paymode = req.body.paymode
    const valid_modes = ['takeaway', 'cash', 'bank', 'mercadopago']
    let sale = req.body

    if (!sale || !Object.keys(sale).length) {
      return res.json({ status: 'error', message: 'Tu orden está vacía'})
    }

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

      const shop_url = `https://${shop.id}.geotiendas.com`
      sale.subject = 'Orden de compra en ' + shop.shop
      sale.description = 'Compra de ' + sale.count + ' productos en ' + shop.shop
      sale.currency = 'ARS'
      sale.quantity = 1
      sale.created = new Date()
      req.app.db.collection('stock').find({
        active: true
      }).toArray((err, stock) => {

        let prices = stock.flatMap(e => [...e.items])
        let itemsPrices = []

        prices.map(e => {
          itemsPrices[e._id] = e.price
        })

        let shippingCost = 0

        /* shipping cost */
        if (shop.type === 'products' && paymode !== 'takeaway') {
          const distanceMts = geolib.getDistance({
            latitude: shop.geo.lat,
            longitude: shop.geo.lng
          },{
            latitude: sale.customer.geo.lat,
            longitude: sale.customer.geo.lng
          })

          const distanceKm = geolib.convertDistance(distanceMts, 'km')
          const distanceCost = parseFloat(distanceKm * shop.cost_delivery_km)
          const baseCost = parseFloat(shop.cost_delivery_base)
          shippingCost = parseInt(distanceCost + baseCost)
        }

        let items = sale.order.filter(e => e.active && e.count)
        let total = items.reduce((acc, e) => acc + parseInt(e.count * itemsPrices[e._id]), 0)
        sale.shop = shop._id.toString()
        sale.shop_name = shop.shop
        sale.shop_id = shop.id
        sale.delivery_cost = shippingCost
        sale.total = total + shippingCost
        sale.prepared = false
        sale.delivered = false
        sale.cancelled = false
        sale.public_record_seen = 0
        sale.payment_mode = paymode
        sale.payment_complete = false
        
        req.app.db.collection('sales').countDocuments({
          shop: shop._id.toString()
        }, {}, (err, count) => {
          if (err) console.log('err: ' + err)
          sale.id = zeroPad(count + 1, 6)
          req.app.db.collection('sales').insertOne(sale, function (err, response) {
            if(err) {
              return res.status(200).send({ status: 'error', message:  'error: ' + err })
            }
            let result = response.ops[0]
            if (paymode === 'mercadopago') {

              if (!shop.mp_access_token) {
                return res.json({ status: 'error', message: `Access token de Mercadopago no encontrado` })
              }

              mercadopago.configure({
                //sandbox: true,
                access_token: shop.mp_access_token
              })

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
                  success: `${shop_url}/pago-procesado/exito`,
                  failure: `${shop_url}/pago-procesado/error`,
                  pending: `${shop_url}/pago-procesado/pendiente`
                },
                notification_url: 'https://' + req.get('host') + "/shops/payments/mercadopago/notification",
                external_reference: result._id.toString()
              }
              mercadopago.preferences.create(preference).then(function(response) {
                /* send mail with order */
                req.app.io.to(shop._id).emit('sale', result)

                /* mail to buyer */
                emailClient.send({
                  to: sale.customer.email,
                  subject: `[${shop.shop}] Tu compra`,
                  data:{
                    title: 'Registramos tu compra',
                    message: `Hola ${sale.customer.fullname}, recibimos tu compra en ${shop.shop}. Elegiste como método de pago ONLINE. En caso de que no puedas efectivizar el pago ponete en contacto con nosotros para efectivizarlo a través de transferencia por CBU o pagarlo en tu domicilio. La fecha programada de la entrega es ${sale.delivery_date}.<br><br>Tu número de compra es<pre>${sale.id}</pre><br>Muchas gracias por tu compra.`,
                    link: `${shop_url}/ventas/` + result._id.toString(),
                    linkText: `Tu compra en ${shop.shop}`,
                    tag: 'proveedor'
                  },
                  templatePath: path.join(__dirname,'/../email/template.html')
                }).catch(function(err){
                  if(err) console.log(`email error: ${err}`)                
                })

                /* mail to customer */
                emailClient.send({
                  to: shop.email,
                  subject: `[${shop.shop}] Venta`,
                  data:{
                    title: 'Nueva venta',
                    message: `Hola ${shop.first_name}, registramos una venta en tu geotienda ${shop.shop}. <br>El número de la venta es <pre>${sale.id}</pre>`,
                    link: `https://gestor.geotiendas.com/ventas`,
                    linkText: `Ver ventas`,
                    tag: 'proveedor'
                  },
                  templatePath: path.join(__dirname,'/../email/template.html')
                }).catch(function(err){
                  if(err) console.log(`email error: ${err}`)                
                })
                return res.json({ status: 'success', data: response.body })
              }).catch(function(err){
                if (err) console.log(`mercadopago error: ${err}`);
                return res.json({ status: 'error', message: `mercadopago error:${err}` })
              })
            } else {

              /* not mercadopago payment */
              let message = `Hola ${sale.customer.fullname}, recibimos tu compra en ${shop.shop}.`
              if (paymode === 'bank') {
                message+= `Elegiste como método de pago CBU. Ponemos a tu disposición los datos para hacer efectiva tu compra en ${shop.shop}<br>------------------------------------<br><pre>
Entidad: ${shop.bank_entity}
Titular: ${shop.bank_owner}
CBU: ${shop.bank_cbu}
Alias: ${shop.bank_alias}
Cuenta: ${shop.bank_account}
</pre><br>------------------------------------<br><br>Por favor indicanos el Número de Pedido en los datos adicionales de la transferencia así podemos identificar tu pago más fácilmente.`
              }

              if (paymode === 'cash') {
                message+= `Elegiste como método de pago ENVÍO A DOMICILIO, te cobraremos esta compra en tu domicilio.<br>`
              }

              if (paymode === 'takeaway') {
                message+= `Elegiste como método de pago Retiro en Sucursal, te cobraremos esta compra en nuestra sucursal cuando vengas a retirarlo.<br>------------------------------------<br><pre>${shop.address} ${shop.address_extra}</pre><br>------------------------------------<br><br><br>`
              }

              message+= `<br>Tu número de compra es<pre>${sale.id}</pre><br>Muchas gracias por tu compra.`

              /* mail to buyer */
              emailClient.send({
                to: sale.customer.email,
                subject: `[${shop.shop}] Tu compra`,
                data:{
                  title: `[${shop.shop}] Tu compra`,
                  message: message,
                  link: `${shop_url}/ventas/` + result._id.toString(),
                  linkText: `Tu compra en ${shop.shop}`,
                  tag: 'proveedor'
                },
                templatePath: path.join(__dirname,'/../email/template.html')
              }).catch(function(err){
                if(err) console.log(`email error: ${err}`)                
              })

              /* mail to customer */
              emailClient.send({
                to: shop.email,
                subject: `[${shop.shop}] Venta`,
                data:{
                  title: `[${shop.shop}] Venta`,
                  message: `Hola ${shop.first_name}, registramos una venta en tu geotienda ${shop.shop}. <br>El número de la venta es <pre>${sale.id}</pre>`,
                  link: `https://gestor.geotiendas.com/ventas/` + result._id.toString(),
                  linkText: `Ver venta`,
                  tag: 'proveedor'
                },
                templatePath: path.join(__dirname,'/../email/template.html')
              }).catch(function(err){
                if(err) console.log(`email error: ${err}`)                
              })

              return res.json({ status: 'success', data: result })
            }
          })
        })
      })
    })
  },
  from_quote: (req, res, next) => {
    // Acttuaiza modo de pago de una venta
    const paymode = req.body.paymode
    const valid_modes = ['takeaway', 'cash', 'bank', 'mercadopago']
    if (!valid_modes.includes(paymode)) {
      return res.json({ status: 'error', message: 'Método de pago inválido'})
    }

    req.app.db.collection('quotes').findOneAndUpdate(
    {
      _id: new ObjectId(req.params.quote)
    },{
      "$set" : {
        updated: moment().format()
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

        if (err) {
          return res.status(200).send({ status: 'error', message:  'error: ' + err })
        }
        if (!shop) {
          return res.status(200).send({ status: 'error', message:  'No such shop' })
        }

        req.app.db.collection('sales').countDocuments({
          shop: quote.shop
        }, {}, (err, count) => {
          if (err) console.log('err: ' + err)
          const shop_url = `https://${shop.id}.geotiendas.com`
          const quote_id = quote._id.toString()
          delete quote._id
          let sale = Object.assign(quote, {})
          sale.id = zeroPad(count + 1, 6)
          sale.payment_complete = false
          sale.from_quote = true
          sale.quote = quote_id
          req.app.db.collection('sales').insertOne(sale, function (err, response) {
            if(err) {
              return res.status(200).send({ status: 'error', message:  'error: ' + err })
            }

            let result = response.ops[0]
            sale.payment_mode = paymode
            sale.payment_complete = false
            if (paymode === 'mercadopago') {

              if (!shop.mp_access_token) {
                return res.json({ status: 'error', message: `Access token de Mercadopago no encontrado` })
              }

              mercadopago.configure({
                //sandbox: true,
                access_token: shop.mp_access_token
              })

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
                  success: `${shop_url}/pago-procesado/exito`,
                  failure: `${shop_url}/pago-procesado/error`,
                  pending: `${shop_url}/pago-procesado/pendiente`
                },
                notification_url: 'https://' + req.get('host') + "/shops/payments/mercadopago/notificacion",
                external_reference: result._id.toString()
              }
              mercadopago.preferences.create(preference).then(function(response) {
                /* send mail with order */
                req.app.io.to(shop._id).emit('sale', result)

                /* mail to buyer */
                emailClient.send({
                  to: sale.customer.email,
                  subject: `[${shop.shop}] Tu compra`,
                  data:{
                    title: 'Registramos tu compra',
                    message: `Hola ${sale.customer.fullname}, recibimos tu compra en ${shop.shop}. Elegiste como método de pago ONLINE. En caso de que no puedas efectivizar el pago ponete en contacto con nosotros para efectivizarlo a través de transferencia por CBU o pagarlo en tu domicilio. La fecha programada de la entrega es ${sale.delivery_date}.<br><br>Tu número de compra es<pre>${sale.id}</pre><br>Muchas gracias por tu compra.`,
                    link: `${shop_url}/ventas/` + result._id.toString(),
                    linkText: `Tu compra en ${shop.shop}`,
                    tag: 'proveedor'
                  },
                  templatePath: path.join(__dirname,'/../email/template.html')
                }).catch(function(err){
                  if(err) console.log(`email error: ${err}`)                
                })

                /* mail to customer */
                emailClient.send({
                  to: shop.email,
                  subject: `[${shop.shop}] Venta`,
                  data:{
                    title: 'Nueva venta',
                    message: `Hola ${shop.first_name}, registramos una venta en tu geotienda ${shop.shop} a raíz de la cotización ${quote.id}. <br>El número de la venta es <pre>${sale.id}</pre>`,
                    link: `https://gestor.geotiendas.com/ventas`,
                    linkText: `Ver ventas`,
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

              /* not mercadopago payment */
              let message = `Hola ${sale.customer.fullname}, recibimos tu compra en ${shop.shop}.`
              if (paymode === 'bank') {
                message+= `Elegiste como método de pago CBU. Ponemos a tu disposición los datos para hacer efectiva tu compra en ${shop.shop}<br>------------------------------------<br><pre>${shop.bank_cbu}</pre><br>------------------------------------<br><br>Por favor indicanos el Número de Pedido en los datos adicionales de la transferencia así podemos identificar tu pago más fácilmente.`
              }

              if (paymode === 'cash') {
                message+= `Elegiste como método de pago ENVÍO A DOMICILIO, te cobraremos esta compra en tu domicilio.<br>`
              }

              if (paymode === 'takeaway') {
                message+= `Elegiste como método de pago Retiro en Sucursal, te cobraremos esta compra en nuestra sucursal cuando vengas a retirarlo.<br>`
              }

              message+= `<br>Tu número de compra es<pre>${sale.id}</pre><br>Muchas gracias por tu compra.`

              /* mail to buyer */
              emailClient.send({
                to: sale.customer.email,
                subject: `[${shop.shop}] Tu compra`,
                data:{
                  title: `[${shop.shop}] Tu compra`,
                  message: message,
                  link: `${shop_url}/ventas/` + result._id.toString(),
                  linkText: `Tu compra en ${shop.shop}`,
                  tag: 'proveedor'
                },
                templatePath: path.join(__dirname,'/../email/template.html')
              }).catch(function(err){
                if(err) console.log(`email error: ${err}`)                
              })

              /* mail to customer */
              emailClient.send({
                to: shop.email,
                subject: `[${shop.shop}] Venta`,
                data:{
                  title: `[${shop.shop}] Venta`,
                  message: `Hola ${shop.first_name}, registramos una venta en tu geotienda ${shop.shop}. <br>El número de la venta es <pre>${sale.id}</pre>`,
                  link: `https://gestor.geotiendas.com/ventas/` + result._id.toString(),
                  linkText: `Ver venta`,
                  tag: 'proveedor'
                },
                templatePath: path.join(__dirname,'/../email/template.html')
              }).catch(function(err){
                if(err) console.log(`email error: ${err}`)                
              })

              return res.json({ status: 'success', data: result })
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
          return req.app.db.collection('sales').findOneAndUpdate(
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

            req.app.db.collection('shops').findOne({
              _id: new ObjectId(doc.value.shop)
            },function(err, shop) {

              if (err || !shop) {
                res.sendStatus(400)
              }

              req.app.io.to(doc.value.shop).emit('mercadopago', doc.value)
              const shop_url = `https://${shop.id}.geotiendas.com`

              let payment_text = ''

              if (shop.payment_text) {
                payment_text = shop.payment_text
              }

              return emailClient.send({
                to: doc.value.customer.email,
                subject: `[${shop.shop}] Recibimos tu pago`,
                data:{
                  title: 'Recibimos tu pago',
                  message: `Hola ${doc.value.customer.fullname}, recibimos tu pago en Geotiendas.<br>${payment_text}<br>Muchas gracias por tu compra.`,
                  link: `${shop_url}/ventas/${doc.value._id}`,
                  linkText: `Tu pago en ${shop.shop}`,
                  tag: 'proveedor'
                },
                templatePath:path.join(__dirname,'/../email/template.html')
              }).then(function(){
                return res.sendStatus(200)
              }).catch(function(err){
                if(err) console.log(err)
                return res.sendStatus(200)
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
     return res.sendStatus(200)
    }
  },
  process: (req, res) => { 
    res.redirect(process.env.APP_URL + '/pago-procesado/' + req.body.payment_status)
  }
}
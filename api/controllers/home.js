const path = require("path")
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const ObjectId = require('mongodb').ObjectId
const mercadopago = require ('mercadopago')
const axios = require('axios')
const moment = require('moment')

const zeroPad = (num, places) => String(num).padStart(places, '0')

module.exports = {
  getHome: (req, res) => {
  	return res.sendFile(path.join(`${__dirname}/../views/index.html`))
	},
  testDateFilter: (req, res) => {
    console.log(moment().subtract(7, 'days').format())
    req.app.db.collection('events').find({history: {"$elemMatch": {created: {"$gte": '2021-02-20T14:17:59+00:00'}}}}).toArray((err, events) => {
      return res.json(events)
    })
  },
	testCount: (req, res) => {
		console.log('---test')
    return axios.get('https://api.mercadopago.com/v1/payments/12155446392?access_token=' + process.env.MP_TOKEN, {} ).then((response) => {
      console.log('---api')
      console.log(response.data)
      if (response.data.status === 'approved') {
        console.log('---approved!')
        return req.app.db.collection('sales').countDocuments({
          mercadopago: {
            status: 'approved'
          }
        }, {}, (err, count) => {
          if (err) {
            console.log('err: ' + err)
          }
          console.log('--update')
          console.log(count)
          console.log(response.data.external_reference)
          return req.app.db.collection('sales').findOneAndUpdate(
          {
            '_id': new ObjectId(response.data.external_reference)
          },
          {
            "$set": {
              id: zeroPad(count + 1, 10),
              mercadopago : response.data
            }
          },{ 
            upsert: false,
            update: true,
            returnOriginal: false 
          }).then(function(doc) {
        // req.app.io.emit('sale', doc.value)

            console.log('--saved')
            console.log(doc.value)
            return emailClient.send({
              to: doc.value.customer.email,
              subject: 'Recibimos tu pedido',
              data:{
                title: 'Recibimos tu pedido',
                message: `Hola ${doc.value.customer.fullname}, recibimos tu pago en YA CABRÓN, estaremos pasando a entregártelo a la brevedad. Muchas gracias por tu compra.`,
                link: process.env.APP_URL + '/pedido/' + doc.value._id,
                linkText: 'Detalles de tu compra',
                tag: 'proveedor'
              },
              templatePath:path.join(__dirname,'/../email/template.html')
            }).then(function(){
              res.sendStatus(200)
            }).catch(function(err){
              if(err) console.log(err)
              res.sendStatus(200)
            })
          }).catch((err) => {
            return res.json(err)
          })
        })
      }
    }).catch((err) => {
      return res.json(err)
    })
	},
	share: (req, res) => {
		req.app.db.collection('proveedores').find({
		  _id: new ObjectId(req.params.id)
		}).project({
		    nombre: 1,
		    avatar: 1,
		    empresa: 1,
		    rubro: 1,
		    zona: 1,
		    localidad: 1,
		    direccion: 1,
		    tagline: 1
		  }).toArray((err,docs) => {

		  	if (docs[0]) {
		  		docs[0].avatar_fa = docs[0].avatar.replace('bucket.festive.com.ar/', 'api.festive.com.ar/bucket/')
		  	}

		    res.render('share', { data: docs[0] })
		    
		    let clickObject = {
		      ip: req.connection.remoteAddress,
		      fecha: new Date()
		    }
		    
		    req.app.db.collection('proveedores').findOneAndUpdate({
		      _id: new ObjectId(req.params.id)
		    },
		    {
		      "$push" : { ['clicks.shared_profile'] : clickObject }
		    })
		})
	}, 
	previewEmail:  (req, res) => {
		return res.sendFile(path.join(`${__dirname}/../email/template.html`))	
	},
	sendTestEmail: (req, res) => {
		emailClient.send({
			to:req.query.email,
			subject: 'Cuenta deshabilitada',
			data:{
				title:'¡Lo sentimos Mariano González!',
				message:'<p>Tu cuenta de proveedor fue deshabilitada temporalmente por incumplimiento de algunas de nuestras políticas de privacidad y/o términos y condiciones de uso.</p><p>En caso de considerarlo necesario, nuestro equipo de soporte se comunicará con usted para solucionarlo.</p>',
				link: process.env.APP_URL + '/como-funciona',
				linkText:'Conocer mas acerca de Festive',
				tag: 'cliente'
			},
			templatePath:path.join(__dirname,'/../email/template.html')
		}).catch(function(err){
			if(err) console.log(err)
		}).then(function(){
			res.status(200).send({ status: 'success' });
		})
	}
}

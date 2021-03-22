const path = require("path")
const bson = require('bson')
const cron = require('node-cron')
const bcrypt = require('bcrypt')
const moment = require('moment')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const ObjectId = require('mongodb').ObjectId

let crons = db => {
	cron.schedule('0 8 * * *', () => {
		db.collection('pagos').find({
			plan: 'Premium',
			vence_avisado: { $exists: false },
			vence: { // 3 days from now
	        	$lte: moment().add(3, 'days').format()
	    	}
		}).toArray((err,docs) => {
			docs.map((e, i) => {
				db.collection('proveedores').findOne({
					_id: new ObjectId(e.proveedor_id)
				}, (err, proveedor) => {
					if (err) return console.log("err: " + err)
					db.collection('pagos').findOneAndUpdate({
						_id: new ObjectId(e._id)
					},{
						"$set" : {
							vence_avisado: moment().format()
						}
					}).then(doc => {
				        emailClient.send({
				          to: proveedor.email,
				          subject: 'Aviso de vencimiento plan Premium',
				          data: {
				            title: `${proveedor.nombre}, tu plan Premium está próximo a vencer`,
				            message: `Tu plan premium vence en tres días.`,
				            link: process.env.PANEL_URL + '/planes',
				            linkText: 'Revalidar plan Premium',
				            tag: 'proveedor'
				          },
				          templatePath:path.join(__dirname,'/../email/template.html')
				        }).catch(function(err){
				          	if(err) console.log(err)
				        }).then(function(){
							db.collection('pagos').findOneAndModify({
								_id: new ObjectId(e._id)
							},{
								vence_avisado: new Date()
							})
				        })
						
					}).catch(err => {
						console.log("err: " + err)
					})
			    })
			})
		})
	})
}

module.exports = crons
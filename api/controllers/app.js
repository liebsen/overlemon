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
const { exec } = require('child_process')
const reservedNames = 'api app cdn share panel gestor partners admin cuenta cuentas comunidad pagos checkout object developers personas administrador ayuda gestion status'

module.exports = {
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
  newsletter: (req, res) => {
    req.body.created = new Date()
    req.body.email = req.body.email.toLowerCase().trim()
    req.app.db.collection('newsletter').findOne({ email: req.body.email }, function (err, exists) {
      if (exists) {
        return res.json({
          status: 'error',
          message: `El correo ${req.body.email} ya se encuentra suscripto al newsletter`
        })
      }
      req.app.db.collection('newsletter').insertOne(req.body, function (err, results) {
        if(err) {
          res.status(200).send({
            status: 'error',
            message: err
          })
        } else {
          return emailClient.send({
            to: req.body.email,
            subject: `Suscripción exitosa`,
            data: {
              title:`Comunidad geotiendas`,
              message:`Gracias por suscribirte a nuestro newsletter. Te mantendremos al tanto de las noticias importantes de geotiendas.`,
              link: `https://comunidad.geotiendas.com`,
              linkText: `Visitar comunidad geotiendas`,
              tag: 'proveedor'
            },
            templatePath:path.join(__dirname,'/../email/template.html')
          }).then(function(){
            res.json({
              status: 'success',
              message: 'Gracias por suscribirte a nuestro newsletter'
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
  basic: (req, res) => {
    let ip = req.header('x-forwarded-for') || '181.209.106.242'
    exec(`./iplookup ${ip}`, (err, stdout, stderr) => {
    // exec(`./iplookup 181.209.106.242`, (err, stdout, stderr) => {
      let locale = []
      if (err) {
        console.log(err)
      } else {
        const parts = stdout.split("\t")
        locale = {
          country: parts[0].split(' ')[1],
          country_iso: parts[1].toLowerCase(),
          city: parts[2],
          region: parts[3]
        }
      }
      req.app.db.collection('landing').findOne({},function(err, landing) {
        req.app.db.collection('settings').findOne({},function(err, settings) {
          req.app.db.collection('shops').find({
            featured: true,
            active: true
          }).toArray((err, shops) => {
            Object.keys(landing.plans).forEach(i => {
              if (!landing.plans[i].active) {
                delete landing.plans[i]
              }
            })
            return res.json({
              locale: locale,
              landing: landing,
              settings: settings,
              shops: shops,
              loaded: true
            })
          })
        })
      })
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
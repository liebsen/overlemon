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
const reservedNames = 'api app panel gestor admin cuenta cuentas comunidad pagos checkout object developers personas administrador ayuda gestion status'

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
            enabled: true
          }).toArray((err, shops) => {
            return res.json({
              locale: locale,
              landing: landing,
              settings: settings,
              shops: shops
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
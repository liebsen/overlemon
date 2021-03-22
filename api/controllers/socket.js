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
/* clock for checking online users */
/*
setInterval(() => {
  Object.keys(online).forEach(e => {
    Object.keys(online[e]).forEach(i => {
      if (moment(online[e][i]).isBefore(moment().subtract(1, 'minutes').format())) {
        delete online[e][i]
      }
      if (Object.keys(online[e]).length === 0) {
        delete online[e]
      }
    })
  })
}, 1000 * 60)
*/

module.exports = {
  event: (req, res) => {
    const ip = req.headers['x-forwarded-for']
    const uuid = req.body.uuid 
    const now = moment().format()
    let tagObject = {
      ip: ip,
      created: now
    }

    for (var i in req.body) {
      tagObject[i] = req.body[i]
    }

    if (!online[req.params.shop]) {
      online[req.params.shop] = {}
    }

    online[req.params.shop][ip] = now

    if (!tagObject.tag) {
      tagObject.tag = 'end'
      delete online[req.params.shop][ip]
    }

    if (Object.keys(online[req.params.shop]).length === 0) {
      delete online[req.params.shop]
    }

    // console.log(`[${req.params.shop}]: ${tagObject.ip} - ${tagObject.tag}`)

    count = 0
    if (online[req.params.shop]) {
      count = Object.keys(online[req.params.shop]).length
    }

    tagObject.online = count
    req.app.io.to(req.params.shop).emit('event', tagObject)

    if (tagObject.tag === 'end') {
      return res.json({ status: 'success' })
    }
    
    req.app.db.collection('events').findOneAndUpdate(
    {
      shop: req.params.shop
    },
    {
      "$push": {
        clicks: tagObject
      }
    },
    { 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(doc => {
      return res.json({ status: 'success' })
    }).catch(err => {
      if(err){
        return res.json({status: 'error', message:err })
      }
    })
  },
  online: (req, res) => {
    let count = 0
    if (online[req.params.shop]) {
      count = Object.keys(online[req.params.shop]).length
    }
    return res.json({ online: count })
  }
}
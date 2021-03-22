const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const tokenExpires = 86400 * 30 * 12 // 1 year
const saltRounds = 10
const moment = require('moment')
const ObjectId = require('mongodb').ObjectId

module.exports = {
  check: (req, res, next) => {
    const token = req.headers['authorization']
    if(typeof token !== 'undefined') {
      jwt.verify(token, process.env.APP_SECRET, function(err, decoded) {
        if(!err && decoded) {
          req.decoded = decoded
          next()
        } else {
          res.sendStatus(403)    
        }
      })    
    } else {
      res.sendStatus(403)
    }
  },
  token:  (req, res) => {
    req.app.db.collection('accounts').find({
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
    var email = req.body.email.toLowerCase()
    var password = req.body.password
    req.app.db.collection('accounts').findOne({
      email: email
    },function(err, user) {
      if (err) return res.status(500).send('Error on the server.')
      if (!user) return res.status(404).send('No user found.')

      // update lastlogin
      req.app.db.collection('accounts').findOneAndUpdate({
        _id: user._id
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
        let passwordIsValid = bcrypt.compareSync(req.body.password, user.password)
        if (!passwordIsValid) return res.status(401).send({ auth: false, token: null })
        let token = jwt.sign({ id: user._id }, process.env.APP_SECRET, {
          expiresIn: tokenExpires
        })
        res.status(200).send({ auth: true, token: token, user: user })
      })
    })
  }
}
const path = require("path")
const bson = require('bson')
const emailHelper = require('../email/helper')
const emailClient = emailHelper()
const ObjectId = require('mongodb').ObjectId

module.exports = {
  list: (req, res) => {
    req.app.db.collection(req.params.c).find({
      _id: new ObjectId(req.params.id)
    }).toArray((err,docs) => {
      let sub = {}
      if (docs[0] && docs[0][req.params.s]) {
        sub = docs[0][req.params.s]
      }
      return res.json(sub)
    })
  },
  search: (req, res) => {
    req.app.db.collection(req.params.c).aggregate(
    { $match : {
      [req.params.s + "." + req.query.where]: req.query.query
    }},
    { $unwind : "$" + req.params.s },
    { $match : {
      [req.params.s + "." + req.query.where]: req.query.query
    }},{ $group: { [req.params.s + "." + req.query.where]: req.query.query, count: { $sum: 1 } } })
    .toArray(function(err,results){
      return res.json(results[0])
    })  
  },
  like: (req, res) => {
    req.app.db.collection(req.params.c).aggregate(
    { $match : {
      [req.params.s + "." + req.query.where]: new RegExp(req.query.query)
    }},
    { $unwind : "$" + req.params.s },
    { $match : {
      [req.params.s + "." + req.query.where]: req.query.query
    }},{ $group: { [req.params.s + "." + req.query.where]: new RegExp(req.query.query), count: { $sum: 1 } } })
    .toArray(function(err,results){
      return res.json(results[0])
    })  
  },
  item: (req, res) => {
    req.app.db.collection(req.params.c).aggregate(
    { $match : {
      "_id": new ObjectId(req.params.id),
      [req.params.s + "._id"]: req.params.sid
    }},
    { $unwind : "$" + req.params.s },
    { $match : {
      "_id": new ObjectId(req.params.id),
      [req.params.s + "._id"]: req.params.sid
    }},{ $group: { [req.params.s + "._id"]: req.params.sid, count: { $sum: 1 } } })
    .toArray(function(err,results){
      return res.json(results[0])
    })  
  },
  update: (req, res) => {
    req.app.db.collection(req.params.c).findOneAndUpdate(
    {
      "_id": new ObjectId(req.params.id),
      [req.params.s + "._id"]: req.params.sid
    },
    {
      "$set" : { [req.params.s + ".$"] : req.body }
    },
    { 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error: ' + err
        })
      }
    })
  },
  delete: (req, res) => {
    req.app.db.collection(req.params.c).updateOne(
    {
      "_id": new ObjectId(req.params.id),
      [req.params.s + "._id"]: req.params.sid
    },
    {
      "$pull": { [req.params.s]: { _id: req.params.sid }}
    },{ 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error: ' + err
        })
      }
    })  
  },
  create: (req, res) => {
    req.body._id = new ObjectId().toString()
    req.app.db.collection(req.params.c).findOneAndUpdate(
    {
      "_id": new ObjectId(req.params.id),
    },
    {
      "$push" : { [req.params.s] : req.body }
    },
    { 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error: ' + err
        })
      }
    })
  },
  push: (req, res) => {
    req.app.db.collection(req.params.c).findOneAndUpdate(
    {
      _id : new ObjectId(req.params.id)
    },
    {
      "$push" : { [req.params.s] : { "$each" : req.body } }
    },
    { 
      upsert: true, 
      'new': true, 
      returnOriginal:false 
    }).then(function(doc){
      return res.json(doc.value)
    }).catch(function(err){
      if(err){
        return res.json({
          status: 'error: ' + err
        })
      }
    })
  }
}
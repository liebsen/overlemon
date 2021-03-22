const path = require('path')
const compression = require('compression');
const express = require("express")
const app = express()
const bodyParser = require('body-parser')
const mongodb = require('mongodb')
const cors = require('cors')
const http = require('http').Server(app)
const io = require('socket.io')(http, { origins: '*:*', pingInterval: 15000, query: { origin: 'api' }})
const routesManager = require("./routes/web")
const cronManager = require("./cron")
const socketManager = require("./socket")
const mustacheExpress = require('mustache-express')
const corsOptions = {
  origin: [
    /^http:\/\/localhost/,
    /^http:\/\/192.168.2.13/,
    /geotiendas\.com$/
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE"
}

// app.set('trust proxy', true)
app.set('etag', false)
app.use(compression())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'static')))
app.use(cors(corsOptions))

mongodb.MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true, useNewUrlParser: true }, function(err, database) {
	if(err) throw err
	const db = database.db(process.env.MONGO_URL.split('/').reverse()[0])
	const port = process.env.PORT || 5500

	app.db = db
	app.io = io

	routesManager(app)
	cronManager(db)

  let connected = {}

	io.on('connection', socket => {
    const clientIp = socket.handshake.headers['x-forwarded-for'] || '181.209.106.242'
    console.log(`connected ${socket.id} ip: ${clientIp}`)

    var handshake = socket.handshake
    if (handshake.query.origin) {
      console.log('origin: ' + handshake.query.origin)
      if (handshake.query.origin === 'shop' && handshake.query.shop) {
        let shop = handshake.query.shop
        console.log('shop: ' + shop)
        socket.shop = shop

        if (!connected[shop]) {
          connected[shop] = []
        }

        if (!connected[shop][socket.id]) {
          connected[shop].push(socket.id)
        }
        socket.to(shop).emit('connected', connected[shop].length)
        socket.to('geotiendas').emit('connected', connected)
      }
    }

	 	socket.on('event', data => {
      if (socket.shop) {
        data.shop_name = socket.shop
        socketManager.saveEvent(db, data, clientIp)
        socket.to(data.shop).emit('event', data)
        socket.to('geotiendas').emit('event', data)
      }
	 	})

    socket.on('joinRoom', data => {
      console.log(`[${data}] joins room`)
      socket.join(data)
    })

    socket.on('leaveRoom', data => {
      console.log(`[${data}] leaves room`)
      socket.leave(data)
    })

    socket.on('findConnected', data => {
      if (connected[data]) {
        socket.emit('connected', connected[data].length)
      }
    })

    socket.on('findConnectedAll', () => {
      socket.emit('connected', connected)
    })

    socket.on('disconnect', () => {
      console.log(`disconnected ${socket.id}`)
      if (connected[socket.shop]) {
        connected[socket.shop] = connected[socket.shop].filter(e => e !== socket.id)
        const length = connected[socket.shop].length
        if (length === 0) {
          delete connected[socket.shop]
        }
        socket.to(socket.shop).emit('connected', length)
        console.log(connected)
        socket.to('geotiendas').emit('connected', connected)
      }
    })
	})

  var server = http.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
  })
})

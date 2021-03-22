const express = require("express")
const router = express.Router()
const home = require("../controllers/home")
const upload = require("../controllers/upload")
const application = require("../controllers/app")
const community = require("../controllers/community")
const panel = require("../controllers/panel")
const shops = require("../controllers/shops")
const admin = require("../controllers/admin")
const quotes = require("../controllers/quotes")
const payments = require("../controllers/payments")
const plans_payments = require("../controllers/plans_payments")
const collection = require("../controllers/collection")
const embedded = require("../controllers/embedded")
const auth = require("../controllers/auth")

let routes = app => {
	
	/* Public */	
	/* api.festive.com.ar */

	router.get("/", home.getHome)
	router.get("/send-email", home.sendTestEmail)
	router.get("/test-dates", home.testDateFilter)
	router.get("/test-count", home.testCount)
	router.get("/preview-email", home.previewEmail)
	// router.post("/testNotification", home.testNotification)

	/******************* app */
	router.post('/contact', application.contact)
	router.post('/newsletter', application.newsletter)
	router.get('/basic', application.basic)

	/******************* community */
	router.get('/community/basic', community.basic)


	/******************* shops */
	router.post('/shops/create', shops.create)	
	router.get('/shops/basic/:shop', shops.basic)
	router.post('/shops/contact/:shop', shops.contact)

  /* shops sales */
	router.post('/shops/sales/:sale', shops.sale)
	router.post('/shops/sales/calc_shipping/:shop', shops.calc_shipping)

	/* shops blogs */
	router.get('/shops/news/:shop', shops.blog.listing)
	router.post('/shops/news/search/:shop', shops.blog.search)
	router.get('/shops/news/:shop/:slug', shops.blog.category)
	router.get('/shops/news/:shop/:slug/:sslug', shops.blog.entry)

	/* shops payments */
	router.post('/shops/payments/:shop', payments.create)
	router.post('/shops/payments/quote/:quote', payments.from_quote)
	router.post('/shops/payments/mercadopago/notification', payments.notification)

	/* shops quotes */
	router.post('/shops/quotes/:quote', quotes.quote)
	router.post('/shops/quotes/create/:shop', quotes.create)


	/******************* panel */
	router.post('/panel/login', panel.login)
	router.post('/panel/token', auth.check, panel.token)
	// router.post('/shops/events/:shop', shops.event)
	// router.post('/shops/online/:shop', shops.online)
	router.post('/shops/checkname', shops.checkname)
	router.post('/panel/validate', panel.validate)
	router.post('/panel/dash', auth.check, panel.dash)
	router.get('/panel/basic/:shop', panel.basic)
	router.get('/panel/advanced/:shop', panel.advanced)
	router.post('/panel/searchall', auth.check, panel.searchall)
	router.post('/panel/quotes/reply/:quote', auth.check, quotes.reply)

	/* auth panel */
	router.post('/panel/restore_password', panel.restore_password)
	router.post('/panel/update_password', panel.update_password)


	/* pagos planes */
	router.post('/panel/payments/:shop', plans_payments.create)
	router.post('/panel/payments/mercadopago/notification', plans_payments.notification)


	/******************* admin */
	router.post('/admin/login', admin.login)
	router.post('/admin/token', auth.check, auth.token)
	router.post('/admin/create_account', admin.create_account)
	router.post('/admin/restore_password', admin.restore_password)
	router.post('/admin/update_password', admin.update_password)
	router.post('/admin/change_password', auth.check, admin.change_password)
	router.post('/admin/search', auth.check, admin.search)
	router.post('/admin/dash', auth.check, admin.dash)

	/* files */
	
	router.get(
		'/upload/list',
		auth.check,
		upload.getFiles
	)

	router.post(
		'/upload/delete',
		auth.check,
		upload.deleteFile
	)

	router.post(
		'/upload/multi',
		auth.check,
		upload.uploadFiles,
		upload.resizeImages,
		upload.getResult
	)

	/* actions performed on properties */
	router.get('/:c', auth.check, collection.list)
	router.post('/:c/sort', auth.check, collection.sort)
	router.get('/:c/search', auth.check, collection.search)
	router.get('/:c/like', auth.check, collection.like)
	router.get('/:c/:id', auth.check, collection.item)
	router.put('/:c', auth.check, collection.create)
	router.post('/:c/:id', auth.check, collection.update)
	router.delete('/:c/:id', auth.check, collection.delete)
	router.delete('/:c/:key/:val', auth.check, collection.deleteManyByKey)

	/* actions performed on embedded objects */
	router.get('/:c/search/:s', auth.check, embedded.search)
	router.get('/:c/like/:s', auth.check, embedded.like)
	router.get('/:c/:id/:s', auth.check, embedded.list)
	router.get('/:c/:id/:s/:sid', auth.check, embedded.item)
	router.put('/:c/:id/:s', auth.check, embedded.create)
	router.post('/:c/:id/:s', auth.check, embedded.push)
	router.post('/:c/:id/:s/:sid', auth.check, embedded.update)
	router.delete('/:c/:id/:s/:sid', auth.check, embedded.delete)

	return app.use("/", router)
}

module.exports = routes
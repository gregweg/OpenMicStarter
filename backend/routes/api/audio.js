var router = require('express').Router();
var mongoose = require('mongoose');
var Audio = mongoose.model('Audio');
var Comment = mongoose.model('Comment');
var User = mongoose.model('User');
var auth = require('../auth');

// Preload article objects on routes with ':article'
router.param('article', function(req, res, next, slug) {
	Audio.findOne({ slug: slug})
		.populate('author')
		.then(function (article) {
			if (!article) { return res.sendStatus(404); }

			req.article = article;

			return next();
		}).catch(next);
});

router.param('comment', function(req, res, next, id) {
	Comment.findById(id).then(function(comment) {
		if(!comment) { return res.sendStatus(404); }

		req.comment = comment;

		return next();
	}).catch(next);
});

router.get('/', auth.optional, function(req, res, next) {
	var query = {};
	var limit = 20;
	var offset = 0;

	if(typeof req.query.limit !== 'undefined') {
		limit = req.query.limit;
	}

	if(typeof req.query.offset !== 'undefined') {
		offset = req.query.offset;
	}

	if (typeof req.query.tag !== 'undefined') {
		query.tagList = {"$in" : [req.query.tag]};
	}

	Promise.all([
		req.query.author ? User.findOne({username: req.query.author}) : null,
		req.query.favorited ? User.findOne({username: req.query.favorited}) : null
	]).then(function(results) {
		var author = results[0];
		var favoriter = results[1];

		if(author) {
			query.author = author._id;
		}

		if(favoriter){
			query._id = {$in: favoriter.favorites};
		} else if(req.query.favorited) {
			query._id = {$in: []};
		}

		return Promise.all([
			Audio.find(query)
				.limit(Number(limit))
				.skip(Number(offset))
				.sort({createdAt: 'desc'})
				.populate('author')
				.exec(),
			Audio.count(query).exec(),
			req.payload ? User.findById(req.payload.id) : null,
		]).then(function(results) {
			var articles = results[0];
			var articlesCount = results[1];
			var user = results[2];

			return res.json({
				audios: audios.map(function(article) {
					return audio.toJSONFor(user);
				}),
				articlesCount: articlesCount
			});
		});
	}).catch(next);
});

router.get('/feed', auth.required, function(req, res, next) {
	var limit = 20;
	var offset = 0;

	if(typeof req.query.limit !== 'undefined'){
		limit = req.query.limit;
	}

	if(typeof req.query.offset !== 'undefined'){
		offset = req.query.offset;
	}

	User.findById(req.payload.id).then(function(user){
		if (!user) { return res.sendStatus(401); }

		Promise.all([
			Audio.find({ author: {$in: user.following}})
				.limit(Number(limit))
				.skip(Number(offset))
				.populate('author')
				.exec(),
			Audio.count({ author: {$in: user.following}})
		]).then(function(results){
			var audios = results[0];
			var audiosCount = results[1];

			return res.json({
				audios: audios.map(function(audio){
					return audio.toJSONFor(user);
				}),
				audiosCount: audiosCount
			});
		}).catch(next);
	});
});

router.post('/', auth.required, function(req, res, next) {
	User.findById(req.payload.id).then(function(user){
		if (!user) { return res.sendStatus(401); }

		var audio = new Audio(req.body.audio);

		audio.author = user;

		return audio.save().then(function() {
			console.log(article.author);
			return res.json({article: article.toJSONFor(user)});
		});
	}).catch(next);
});

// return an audio
router.get('/:audio', auth.optional, function(req, res, next) {
	Promise.all([
		req.payload ? User.findById(req.payload.id) : null,
		req.audio.populate('author').execPopulate()
	]).then(function(results) {
		var user = results[0];

		return res.json({audio: req.audio.toJSONFor(user)});
	}).catch(next);
});

// update article
router.put('/:audio', auth.required, function(req, res, next) {
	User.findById(req.payload.id).then(function(user){
		if(req.audio.author._id.toString() === req.payload.id.toString()) {
			if(typeof req.body.audio.title !== 'undefined') {
				req.audio.title = req.body.audio.title;
			}

			if(typeof req.body.audio.description !== 'undefined'){
				req.audio.description = req.body.audio.description;
			}

			if(typeof req.body.audio.body !== 'undefined'){
				req.audio.body = req.body.audio.body;
			}
		}
	})
});

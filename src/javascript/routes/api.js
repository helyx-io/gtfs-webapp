////////////////////////////////////////////////////////////////////////////////////
// Imports
////////////////////////////////////////////////////////////////////////////////////

var fs = require('fs');

var express = require('express');
var passport = require('passport');

var modulePackage = require('../package.json');
var security = require('../lib/security');
var models = require('../models');

var agencies = require('./agencies.js');

////////////////////////////////////////////////////////////////////////////////////
// Routes
////////////////////////////////////////////////////////////////////////////////////

var router = express.Router();

router.get('/', (req, res) => {
	res.json({version: modulePackage.version});
});

router.use("/agencies", agencies);


////////////////////////////////////////////////////////////////////////////////////
// Exports
////////////////////////////////////////////////////////////////////////////////////

module.exports = router;

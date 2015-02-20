////////////////////////////////////////////////////////////////////////////////////
// Imports
////////////////////////////////////////////////////////////////////////////////////

var fs = require('fs');
var util = require('util');
var async = require('async');
var Promise = require('bluebird');

var logger = require('../log/logger');
var DB = require('../lib/db');

var config = require('../conf/config');

var redis = require('redis');
//redis.debug_mode = true;

var ssdb = require('ssdb');

var ssdbClient = ssdb.createClient(config.redis.port, config.redis.host);
ssdbClient.promisify();

var redisClient = redis.createClient(config.redis.port, config.redis.host);

var Cache = require("../lib/cache");


////////////////////////////////////////////////////////////////////////////////////
// Functions
////////////////////////////////////////////////////////////////////////////////////

var findTrips = (agencyKey) => {

	var db = DB.schema(agencyKey);

	return db.TripServices.query( (q) => q ).fetch().then((trips) => {

		return trips.toJSON();
	});
};


var findByTripId = (agencyKey, tripId) => {

	var db = DB.schema(agencyKey);

	return new db.TripService({ trip_id: tripId }).fetch().then((trip) => {

		return !trip ? undefined : trip.toJSON();
	});
};


var findStopTimesByTripId = (agencyKey, tripId) => {

	var db = DB.schema(agencyKey);

	var fetchStart = Date.now();
	var cacheKey = `/agencies/${agencyKey}/trips/${tripId}/stop-times`;
	return Cache.fetch(redisClient, cacheKey).otherwhise({ }, (callback) => {
		var start = Date.now();

		db.StopTimes.query( (q) => q.where({ trip_id: tripId }) ).fetch({ withRelated: ['stop'] }).then((stopTimes) => {
			logger.info(`DB Query Done in ${Date.now() - start} ms`);

			stopTimes = stopTimes.toJSON();

			stopTimes.sort((st1, st2) => st1.stop_sequence - st2.stop_sequence);

			callback(undefined, stopTimes);
		});

	}).then((stopTimes) => {
		logger.info(`[TRIP][FIND_STOP_TIMES_BY_TRIP_ID] Data Fetch for key: '${cacheKey}' Done in ${Date.now() - fetchStart} ms`);
		return stopTimes;
	});
};


var findStopTimesByTripIds = (agencyKey, tripIds) => {

	var db = DB.schema(agencyKey);

	var fetchStart = Date.now();

	var cacheKeys = tripIds.map((tripId) => {
		return `/agencies/${agencyKey}/trips/${tripId}/stop-times`;
	});

	return ssdbClient.multi_get(cacheKeys).then((stopTimesSets) => {
		if (stopTimesSets.length == 0) {
			return jsonStopTimesSets;
		}

		var stopTimesResults = {};
		for (var i = 0 ; i < stopTimesSets.length ; i += 2) {
			stopTimesResults[stopTimesSets[i]] = stopTimesSets[i + 1];
		}

		stopTimesSets = tripIds.map((tripId) => {
			return stopTimesResults[`/agencies/${agencyKey}/trips/${tripId}/stop-times`];
		});

		var jsonStopTimesSets = JSON.parse('[' + stopTimesSets.join(',') + ']');

		logger.info(`[TRIP][FIND_STOP_TIMES_BY_TRIP_ID] Data Fetch for key: '${JSON.stringify(cacheKeys)}' Done in ${Date.now() - fetchStart} ms`);

		return jsonStopTimesSets;
	});
};

////////////////////////////////////////////////////////////////////////////////////
// Exports
////////////////////////////////////////////////////////////////////////////////////

module.exports = {
	findTrips: findTrips,
	findByTripId: findByTripId,
	findStopTimesByTripId: findStopTimesByTripId,
	findStopTimesByTripIds: findStopTimesByTripIds
};


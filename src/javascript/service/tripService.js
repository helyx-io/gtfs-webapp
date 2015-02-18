////////////////////////////////////////////////////////////////////////////////////
// Imports
////////////////////////////////////////////////////////////////////////////////////

var fs = require('fs');
var util = require('util');
var async = require('async');

var logger = require('../log/logger');
var DB = require('../lib/db');

var config = require('../conf/config');

var redis = require('redis');
//redis.debug_mode = true;

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

var putStopTimesByTripIdInCache = (agencyKey) => {
	var db = DB.schema(agencyKey);

	var count = 0;

	var fetchStart = Date.now();
	var tripIdsPromise = db.knex.select('trip_id').from('trips');

	tripIdsPromise.then((trips) => {

		async.eachLimit(trips, 32, (trip, cb) => {

			var tripId = trip.trip_id;
			var stopTimesQueryStart = Date.now();
			db.StopTimes.query( (q) => q.where({ trip_id: tripId }) ).fetch({ withRelated: ['stop'] }).then((stopTimes) => {
				logger.info(`[${++count}] DB StopTimes with stop for tripId: ${tripId} Query Done in ${Date.now() - stopTimesQueryStart} ms`);

				stopTimes = stopTimes.toJSON();

				stopTimes.sort((st1, st2) => st1.stop_sequence - st2.stop_sequence);

				var cacheKey = `/agencies/${agencyKey}/trips/${tripId}/stop-times`;
				redisClient.set(cacheKey, JSON.stringify(stopTimes), (err) => {
					cb(err);
				});
			});

		}, (err) => {
			logger.info(`[TRIP] Inserted stopTimes for ${trips.length} trips done in ${Date.now() - fetchStart} ms`);
		});

		logger.info(`[TRIP] Data fetch done in ${Date.now() - fetchStart} ms`);
	});

	return tripIdsPromise;
}


////////////////////////////////////////////////////////////////////////////////////
// Exports
////////////////////////////////////////////////////////////////////////////////////

module.exports = {
	findTrips: findTrips,
	findByTripId: findByTripId,
	findStopTimesByTripId: findStopTimesByTripId,
	putStopTimesByTripIdInCache: putStopTimesByTripIdInCache
};


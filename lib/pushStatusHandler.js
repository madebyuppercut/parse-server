'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.flatten = flatten;
exports.default = pushStatusHandler;

var _cryptoUtils = require('./cryptoUtils');

var _logger = require('./logger');

function flatten(array) {
  return array.reduce(function (memo, element) {
    if (Array.isArray(element)) {
      memo = memo.concat(flatten(element));
    } else {
      memo = memo.concat(element);
    }
    return memo;
  }, []);
}

function pushStatusHandler(config) {

  var initialPromise = void 0;
  var pushStatus = void 0;

  var collection = function collection() {
    return config.database.adaptiveCollection('_PushStatus');
  };

  var setInitial = function setInitial() {
    var body = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    var where = arguments[1];
    var options = arguments.length <= 2 || arguments[2] === undefined ? { source: 'rest' } : arguments[2];

    var now = new Date();
    var data = body.data || {};
    var object = {
      objectId: (0, _cryptoUtils.newObjectId)(),
      pushTime: now.toISOString(),
      _created_at: now,
      query: JSON.stringify(where),
      payload: body.data,
      source: options.source,
      title: options.title,
      expiry: body.expiration_time,
      status: "pending",
      numSent: 0,
      pushHash: (0, _cryptoUtils.md5Hash)(JSON.stringify(data)),
      // lockdown!
      _wperm: [],
      _rperm: []
    };
    initialPromise = collection().then(function (collection) {
      return collection.insertOne(object);
    }).then(function (res) {
      pushStatus = {
        objectId: object.objectId
      };
      return Promise.resolve(pushStatus);
    });
    return initialPromise;
  };

  var setRunning = function setRunning(installations) {
    _logger.logger.verbose('sending push to %d installations', installations.length);
    return initialPromise.then(function () {
      return collection();
    }).then(function (collection) {
      return collection.updateOne({ status: "pending", objectId: pushStatus.objectId }, { $set: { status: "running" } });
    });
  };

  var complete = function complete(results) {
    var update = {
      status: 'succeeded',
      numSent: 0,
      numFailed: 0
    };
    if (Array.isArray(results)) {
      results = flatten(results);
      results.reduce(function (memo, result) {
        // Cannot handle that
        if (!result.device || !result.device.deviceType) {
          return memo;
        }
        var deviceType = result.device.deviceType;
        if (result.transmitted) {
          memo.numSent++;
          memo.sentPerType = memo.sentPerType || {};
          memo.sentPerType[deviceType] = memo.sentPerType[deviceType] || 0;
          memo.sentPerType[deviceType]++;
        } else {
          memo.numFailed++;
          memo.failedPerType = memo.failedPerType || {};
          memo.failedPerType[deviceType] = memo.failedPerType[deviceType] || 0;
          memo.failedPerType[deviceType]++;
        }
        return memo;
      }, update);
    }
    _logger.logger.verbose('sent push! %d success, %d failures', update.numSent, update.numFailed);
    return initialPromise.then(function () {
      return collection();
    }).then(function (collection) {
      return collection.updateOne({ status: "running", objectId: pushStatus.objectId }, { $set: update });
    });
  };

  var fail = function fail(err) {
    var update = {
      errorMessage: JSON.stringify(err),
      status: 'failed'
    };
    _logger.logger.error('error while sending push', err);
    return initialPromise.then(function () {
      return collection();
    }).then(function (collection) {
      return collection.updateOne({ objectId: pushStatus.objectId }, { $set: update });
    });
  };

  return Object.freeze({
    setInitial: setInitial,
    setRunning: setRunning,
    complete: complete,
    fail: fail
  });
}
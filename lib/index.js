'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParseServer = exports.FileSystemAdapter = exports.GCSAdapter = exports.S3Adapter = undefined;

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _ParseServer2 = require('./ParseServer');

var _ParseServer3 = _interopRequireDefault(_ParseServer2);

var _parseServerGcsAdapter = require('parse-server-gcs-adapter');

var _parseServerGcsAdapter2 = _interopRequireDefault(_parseServerGcsAdapter);

var _parseServerS3Adapter = require('parse-server-s3-adapter');

var _parseServerS3Adapter2 = _interopRequireDefault(_parseServerS3Adapter);

var _parseServerFsAdapter = require('parse-server-fs-adapter');

var _parseServerFsAdapter2 = _interopRequireDefault(_parseServerFsAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (process.env.VERBOSE || process.env.VERBOSE_PARSE_SERVER) {
  _winston2.default.level = 'silly';
}

if (process.env.DEBUG || process.env.DEBUG_PARSE_SERVER) {
  _winston2.default.level = 'debug';
}

// Factory function
var _ParseServer = function _ParseServer(options) {
  var server = new _ParseServer3.default(options);
  return server.app;
};
// Mount the create liveQueryServer
_ParseServer.createLiveQueryServer = _ParseServer3.default.createLiveQueryServer;

exports.default = _ParseServer3.default;
exports.S3Adapter = _parseServerS3Adapter2.default;
exports.GCSAdapter = _parseServerGcsAdapter2.default;
exports.FileSystemAdapter = _parseServerFsAdapter2.default;
exports.ParseServer = _ParseServer;
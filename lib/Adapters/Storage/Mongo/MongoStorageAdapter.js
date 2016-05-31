'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MongoStorageAdapter = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _MongoCollection = require('./MongoCollection');

var _MongoCollection2 = _interopRequireDefault(_MongoCollection);

var _MongoSchemaCollection = require('./MongoSchemaCollection');

var _MongoSchemaCollection2 = _interopRequireDefault(_MongoSchemaCollection);

var _mongodbUrl = require('../../../vendor/mongodbUrl');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

var MongoSchemaCollectionName = '_SCHEMA';

var MongoStorageAdapter = exports.MongoStorageAdapter = function () {
  // Public

  // Private

  function MongoStorageAdapter(uri, options) {
    _classCallCheck(this, MongoStorageAdapter);

    this._uri = uri;
    this._options = options;
  }

  _createClass(MongoStorageAdapter, [{
    key: 'connect',
    value: function connect() {
      var _this = this;

      if (this.connectionPromise) {
        return this.connectionPromise;
      }

      // parsing and re-formatting causes the auth value (if there) to get URI
      // encoded
      var encodedUri = (0, _mongodbUrl.format)((0, _mongodbUrl.parse)(this._uri));

      this.connectionPromise = MongoClient.connect(encodedUri, this._options).then(function (database) {
        _this.database = database;
      });
      return this.connectionPromise;
    }
  }, {
    key: 'collection',
    value: function collection(name) {
      var _this2 = this;

      return this.connect().then(function () {
        return _this2.database.collection(name);
      });
    }
  }, {
    key: 'adaptiveCollection',
    value: function adaptiveCollection(name) {
      var _this3 = this;

      return this.connect().then(function () {
        return _this3.database.collection(name);
      }).then(function (rawCollection) {
        return new _MongoCollection2.default(rawCollection);
      });
    }
  }, {
    key: 'schemaCollection',
    value: function schemaCollection(collectionPrefix) {
      var _this4 = this;

      return this.connect().then(function () {
        return _this4.adaptiveCollection(collectionPrefix + MongoSchemaCollectionName);
      }).then(function (collection) {
        return new _MongoSchemaCollection2.default(collection);
      });
    }
  }, {
    key: 'collectionExists',
    value: function collectionExists(name) {
      var _this5 = this;

      return this.connect().then(function () {
        return _this5.database.listCollections({ name: name }).toArray();
      }).then(function (collections) {
        return collections.length > 0;
      });
    }
  }, {
    key: 'dropCollection',
    value: function dropCollection(name) {
      return this.collection(name).then(function (collection) {
        return collection.drop();
      });
    }
    // Used for testing only right now.

  }, {
    key: 'collectionsContaining',
    value: function collectionsContaining(match) {
      var _this6 = this;

      return this.connect().then(function () {
        return _this6.database.collections();
      }).then(function (collections) {
        return collections.filter(function (collection) {
          if (collection.namespace.match(/\.system\./)) {
            return false;
          }
          return collection.collectionName.indexOf(match) == 0;
        });
      });
    }
  }]);

  return MongoStorageAdapter;
}();

exports.default = MongoStorageAdapter;

module.exports = MongoStorageAdapter; // Required for tests
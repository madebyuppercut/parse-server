'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _MongoCollection = require('./MongoCollection');

var _MongoCollection2 = _interopRequireDefault(_MongoCollection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _mongoSchemaQueryFromNameQuery(name, query) {
  return _mongoSchemaObjectFromNameFields(name, query);
}

function _mongoSchemaObjectFromNameFields(name, fields) {
  var object = { _id: name };
  if (fields) {
    Object.keys(fields).forEach(function (key) {
      object[key] = fields[key];
    });
  }
  return object;
}

var MongoSchemaCollection = function () {
  function MongoSchemaCollection(collection) {
    _classCallCheck(this, MongoSchemaCollection);

    this._collection = collection;
  }

  _createClass(MongoSchemaCollection, [{
    key: 'getAllSchemas',
    value: function getAllSchemas() {
      return this._collection._rawFind({});
    }
  }, {
    key: 'findSchema',
    value: function findSchema(name) {
      return this._collection._rawFind(_mongoSchemaQueryFromNameQuery(name), { limit: 1 }).then(function (results) {
        return results[0];
      });
    }

    // Atomically find and delete an object based on query.
    // The result is the promise with an object that was in the database before deleting.
    // Postgres Note: Translates directly to `DELETE * FROM ... RETURNING *`, which will return data after delete is done.

  }, {
    key: 'findAndDeleteSchema',
    value: function findAndDeleteSchema(name) {
      // arguments: query, sort
      return this._collection._mongoCollection.findAndRemove(_mongoSchemaQueryFromNameQuery(name), []).then(function (document) {
        // Value is the object where mongo returns multiple fields.
        return document.value;
      });
    }
  }, {
    key: 'addSchema',
    value: function addSchema(name, fields) {
      var mongoObject = _mongoSchemaObjectFromNameFields(name, fields);
      return this._collection.insertOne(mongoObject);
    }
  }, {
    key: 'updateSchema',
    value: function updateSchema(name, update) {
      return this._collection.updateOne(_mongoSchemaQueryFromNameQuery(name), update);
    }
  }, {
    key: 'upsertSchema',
    value: function upsertSchema(name, query, update) {
      return this._collection.upsertOne(_mongoSchemaQueryFromNameQuery(name, query), update);
    }
  }]);

  return MongoSchemaCollection;
}();

exports.default = MongoSchemaCollection;
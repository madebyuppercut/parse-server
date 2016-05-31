'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _MongoCollection = require('./MongoCollection');

var _MongoCollection2 = _interopRequireDefault(_MongoCollection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function mongoFieldToParseSchemaField(type) {
  if (type[0] === '*') {
    return {
      type: 'Pointer',
      targetClass: type.slice(1)
    };
  }
  if (type.startsWith('relation<')) {
    return {
      type: 'Relation',
      targetClass: type.slice('relation<'.length, type.length - 1)
    };
  }
  switch (type) {
    case 'number':
      return { type: 'Number' };
    case 'string':
      return { type: 'String' };
    case 'boolean':
      return { type: 'Boolean' };
    case 'date':
      return { type: 'Date' };
    case 'map':
    case 'object':
      return { type: 'Object' };
    case 'array':
      return { type: 'Array' };
    case 'geopoint':
      return { type: 'GeoPoint' };
    case 'file':
      return { type: 'File' };
  }
}

var nonFieldSchemaKeys = ['_id', '_metadata', '_client_permissions'];
function mongoSchemaFieldsToParseSchemaFields(schema) {
  var fieldNames = Object.keys(schema).filter(function (key) {
    return nonFieldSchemaKeys.indexOf(key) === -1;
  });
  var response = fieldNames.reduce(function (obj, fieldName) {
    obj[fieldName] = mongoFieldToParseSchemaField(schema[fieldName]);
    return obj;
  }, {});
  response.ACL = { type: 'ACL' };
  response.createdAt = { type: 'Date' };
  response.updatedAt = { type: 'Date' };
  response.objectId = { type: 'String' };
  return response;
}

var defaultCLPS = Object.freeze({
  find: { '*': true },
  get: { '*': true },
  create: { '*': true },
  update: { '*': true },
  delete: { '*': true },
  addField: { '*': true }
});

function mongoSchemaToParseSchema(mongoSchema) {
  var clpsFromMongoObject = {};
  if (mongoSchema._metadata && mongoSchema._metadata.class_permissions) {
    clpsFromMongoObject = mongoSchema._metadata.class_permissions;
  }
  return {
    className: mongoSchema._id,
    fields: mongoSchemaFieldsToParseSchemaFields(mongoSchema),
    classLevelPermissions: _extends({}, defaultCLPS, clpsFromMongoObject)
  };
}

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

  // Return a promise for all schemas known to this adapter, in Parse format. In case the
  // schemas cannot be retrieved, returns a promise that rejects. Requirements fot the
  // rejection reason are TBD.


  _createClass(MongoSchemaCollection, [{
    key: 'getAllSchemas',
    value: function getAllSchemas() {
      return this._collection._rawFind({}).then(function (schemas) {
        return schemas.map(mongoSchemaToParseSchema);
      });
    }

    // Return a promise for the schema with the given name, in Parse format. If
    // this adapter doesn't know about the schema, return a promise that rejects with
    // undefined as the reason.

  }, {
    key: 'findSchema',
    value: function findSchema(name) {
      return this._collection._rawFind(_mongoSchemaQueryFromNameQuery(name), { limit: 1 }).then(function (results) {
        if (results.length === 1) {
          return mongoSchemaToParseSchema(results[0]);
        } else {
          return Promise.reject();
        }
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

// Exported for testing reasons and because we haven't moved all mongo schema format
// related logic into the database adapter yet.


MongoSchemaCollection._TESTmongoSchemaToParseSchema = mongoSchemaToParseSchema;

// Exported because we haven't moved all mongo schema format related logic
// into the database adapter yet. We will remove this before too long.
MongoSchemaCollection._DONOTUSEmongoFieldToParseSchemaField = mongoFieldToParseSchemaField;

exports.default = MongoSchemaCollection;
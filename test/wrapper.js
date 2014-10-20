'use strict';

var should = require('should'),
  config = require('./config'),
  OSS = require('..'),
  co = require('co');

describe('# thunkify', function() {
  config.wrapper = 'thunk';
  var oss = OSS.create(config);

  it('list bucket', function(done) {
    co(function * () {
      var result = yield oss.listBucket();

      result.ListAllMyBucketsResult.should.have.keys('Owner', 'Buckets');
    })(done);
  });
});

describe('# promisify', function() {
  config.wrapper = 'promise';
  var oss = OSS.create(config);

  it('list bucket', function(done) {
    co(function * () {
      var result = yield oss.listBucket();

      result.ListAllMyBucketsResult.should.have.keys('Owner', 'Buckets');
    })(done);
  });
});

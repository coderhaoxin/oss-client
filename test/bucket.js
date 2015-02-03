'use strict';

var config = require('./config'),
  uuid = require('node-uuid'),
  should = require('should'),
  OSS = require('..');

describe('bucket', function() {
  var oss = OSS.create(config),
    bucketName = uuid.v4();

  it('create bucket', function(done) {
    oss.createBucket({
      bucket: bucketName,
      acl: 'public-read'
    }, function(error, result) {
      should.not.exist(error);
      result.status.should.equal(200);
      done();
    });
  });

  it('get bucket list', function(done) {
    oss.listBucket(function(error, result) {
      should.not.exist(error);
      should.exist(result.ListAllMyBucketsResult);
      done();
    });
  });

  it('list bucket - promise', function() {
    return oss.listBucket().then(function(result) {
      result.ListAllMyBucketsResult.should.have.keys('Owner', 'Buckets');
    });
  });

  it('get bucket acl', function(done) {
    oss.getBucketAcl(bucketName, function(error, result) {
      should.not.exist(error);
      should.exist(result.AccessControlPolicy);
      done();
    });
  });

  it('set bucket acl', function(done) {
    oss.setBucketAcl({
      bucket: bucketName,
      acl: 'private'
    }, function(error, result) {
      should.not.exist(error);
      result.status.should.equal(200);
      done();
    });
  });

  it('delete bucket', function(done) {
    oss.deleteBucket(bucketName, function(error, result) {
      should.not.exist(error);
      result.status.should.equal(204);
      done();
    });
  });
});

describe('error handle', function() {
  it('create bucket - 403', function(done) {
    var invalidClient = OSS.create({
      accessKeyId: 'invalid',
      accessKeySecret: 'invalid'
    });

    invalidClient.createBucket({
      bucket: 'bucket'
    }, function(error) {
      error.status.should.equal(403);
      error.code[0].should.equal('InvalidAccessKeyId');
      done();
    });
  });

  it('invalid host', function(done) {
    var invalidClient = OSS.create({
      host: 'localhost',
      agent: false,
      accessKeyId: 'invalid',
      accessKeySecret: 'invalid'
    });

    invalidClient.listBucket(function(error) {
      should.exist(error);
      done();
    });
  });
});

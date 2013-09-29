var ossAPI = require('../index');
var oss = new ossAPI.OssClient({
  accessKeyId: '',
  accessKeySecret: ''
});

var should = require('should');
var uuid   = require('node-uuid');

var bucket = '';

describe('object', function () {
  var object = uuid.v4();

  it('put object', function (done) {
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: __filename,
      userMetas: {'x-oss-meta-foo': 'bar'}
    }, function (error, result) {
      result.statusCode.should.equal(200);
      done();
    })
  })
  it('head object', function (done) {
    oss.headObject({
      bucket: bucket,
      object: object
    }, function (error, headers) {
      headers['x-oss-meta-foo'].should.equal('bar');
      done();
    })
  })
  it('list object', function (done) {
    oss.listObject({
      bucket: bucket
    }, function (error, result) {
      result.ListBucketResult.Contents.length.should.above(0);
      done();
    })
  })
  it('delete object', function (done) {
    oss.deleteObject({
      bucket: bucket,
      object: object
    }, function (error, result) {
      result.statusCode.should.equal(204);
      done();
    })
  })
})

var Buffer = require('buffer').Buffer;

describe('put object by buffer', function () {
  var object = uuid.v4();

  it('put object', function (done) {
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: new Buffer("hello,wolrd", "utf8")
    }, function(error, result) {
      result.statusCode.should.equal(200);
      done();
    });
  })
  it('delete object', function (done) {
    oss.deleteObject({
      bucket: bucket,
      object: object
    }, function (error, result) {
      result.statusCode.should.equal(204);
      done();
    })
  })
})

var fs = require("fs");

describe('put object by stream', function () {
  var object = uuid.v4();

  it('put object', function (done) {
    var input = fs.createReadStream(__filename);
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: input,
      contentLength: fs.statSync(__filename).size
    }, function(error, result) {
      result.statusCode.should.equal(200);
      done();
    })
  })
  it('delete object', function (done) {
    oss.deleteObject({
      bucket: bucket,
      object: object
    }, function (error, result) {
      result.statusCode.should.equal(204);
      done();
    })
  })
})

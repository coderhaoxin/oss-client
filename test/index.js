var ossAPI = require('../index');
var option = require('./config').option;
var oss = new ossAPI.OssClient(option);

var should = require('should');

var bucket = require('./config').bucket;
var object = Date.now().toString();

describe('object', function () {
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

var OSS = require('../index');
var config = require('./config');
var oss = new OSS.OssClient(config);

var should = require('should');
var uuid   = require('node-uuid');

var bucket = config.bucket;

describe('object', function () {
  var object = uuid.v4();

  it('put object', function (done) {
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: __filename,
      userMetas: { 'x-oss-meta-foo': 'bar' }
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
  it('download object to write stream', function (done) {
    var ws = fs.createWriteStream('/tmp/oss-test-download-file');
    oss.getObject({
      bucket: bucket,
      object: object,
      dstFile: ws,
    }, function (error, result) {
      should.not.exist(error);
      result.should.eql({statusCode: 200});
      fs.statSync('/tmp/oss-test-download-file').size.should.equal(fs.statSync(__filename).size);
      fs.readFileSync('/tmp/oss-test-download-file', 'utf8').should.equal(fs.readFileSync(__filename, 'utf8'));
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
      srcFile: new Buffer('hello,wolrd', 'utf8')
    }, function (error, result) {
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

describe('put null buffer', function () {
  var object = uuid.v4();

  it('should get error', function (done) {
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: new Buffer('', 'utf8')
    }, function (error, result) {
      should.exist(error);
      error.message.should.equal('null buffer');
      done();
    })
  })
})

var fs = require('fs');

describe('put object by stream', function () {
  var object = uuid.v4();

  it('put object', function (done) {
    var input = fs.createReadStream(__filename);
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: input,
      contentLength: fs.statSync(__filename).size
    }, function (error, result) {
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

describe('bucket', function () {
  var bucketName = uuid.v4();

  it('create bucket', function (done) {
    oss.createBucket({
      bucket: bucketName,
      acl: 'public-read'
    }, function (error, result) {
      should.not.exist(error)
      result.statusCode.should.equal(200)
      done()
    })
  })

  it('get bucket list', function (done) {
    oss.listBucket(function (error, result) {
      should.not.exist(error)
      should.exist(result.ListAllMyBucketsResult)
      done()
    })
  })

  it('get bucket acl', function (done) {
    oss.getBucketAcl(bucketName, function (error, result) {
      should.not.exist(error)
      should.exist(result.AccessControlPolicy)
      done()
    })
  })

  it('set bucket acl', function (done) {
    oss.setBucketAcl({
      bucket: bucketName,
      acl: 'private'
    }, function (error, result) {
      should.not.exist(error)
      result.statusCode.should.equal(200)
      done()
    })
  })

  it('delete bucket', function (done) {
    oss.deleteBucket(bucketName, function (error, result) {
      should.not.exist(error)
      result.statusCode.should.equal(204)
      done()
    })
  })
})

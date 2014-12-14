'use strict';

var config = require('./config'),
  uuid = require('node-uuid'),
  crypto = require('crypto'),
  should = require('should'),
  http = require('http'),
  OSS = require('..'),
  fs = require('fs');

describe('object', function() {
  var oss = OSS.create(config),
    bucket = uuid.v4(),
    object = uuid.v4(),
    object2 = uuid.v4();

  it('create bucket', function(done) {
    oss.createBucket({
      bucket: bucket,
      acl: 'public-read'
    }, function(error, result) {
      should.not.exist(error);
      result.status.should.equal(200);
      done();
    });
  });

  it('put object with filepath', function(done) {
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: __filename,
      userMetas: {
        'x-oss-meta-foo': 'bar'
      }
    }, function(error, result) {
      result.status.should.equal(200);
      done();
    });
  });

  it('put object with buffer', function(done) {
    oss.putObject({
      bucket: bucket,
      object: object2,
      srcFile: new Buffer('oss-client')
    }, function(error, result) {
      result.status.should.equal(200);
      done();
    });
  });

  it('put object - invalid srcFile', function(done) {
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: '/xxoo'
    }, function(error) {
      error.message.should.equal('ENOENT, stat \'/xxoo\'');
      done();
    });
  });

  it('copy object', function(done) {
    oss.copyObject({
      bucket: bucket,
      object: 'copy-' + object,
      srcObject: object
    }, function(error, result) {
      should.not.exist(error);
      should.exist(result.CopyObjectResult);
      done();
    });
  });

  it('head object', function(done) {
    oss.headObject({
      bucket: bucket,
      object: object
    }, function(error, headers) {
      headers['x-oss-meta-foo'].should.equal('bar');
      done();
    });
  });

  it('download object to write stream', function(done) {
    var filepath = __dirname + '/ooxx.swp',
      ws = fs.createWriteStream(filepath);

    oss.getObject({
      bucket: bucket,
      object: object,
      dstFile: ws
    }, function(error, result) {
      should.not.exist(error);
      result.should.eql({
        status: 200
      });
      fs.statSync(filepath).size.should.equal(fs.statSync(__filename).size);
      fs.readFileSync(filepath, 'utf8').should.equal(fs.readFileSync(__filename, 'utf8'));
      done();
    });
  });

  it('download object to file path', function(done) {
    var filepath = __dirname + '/xxoo.swp';

    oss.getObject({
      bucket: bucket,
      object: object,
      dstFile: filepath
    }, function(error, result) {
      should.not.exist(error);
      result.should.eql({
        status: 200
      });
      fs.statSync(filepath).size.should.equal(fs.statSync(__filename).size);
      fs.readFileSync(filepath, 'utf8').should.equal(fs.readFileSync(__filename, 'utf8'));
      done();
    });
  });

  it('get object without dstFile', function(done) {
    oss.getObject({
      bucket: bucket,
      object: object2,
    }, function(error, result) {
      should.not.exist(error);
      result.statusCode.should.equal(200);
      result.body.toString().should.equal('oss-client');
      done();
    });
  });

  it('list object', function(done) {
    oss.listObject({
      bucket: bucket
    }, function(error, result) {
      result.ListBucketResult.Contents.length.should.above(0);
      done();
    });
  });

  it('list object with params', function(done) {
    oss.listObject({
      bucket: bucket,
      prefix: 'test',
      marker: object,
      delimiter: '/',
      maxKeys: 30
    }, function(error, result) {
      should.not.exist(error);
      should.exist(result.ListBucketResult);
      done();
    });
  });

  it('delete object', function(done) {
    oss.deleteObject({
      bucket: bucket,
      object: object
    }, function(error, result) {
      result.status.should.equal(204);
      done();
    });
  });

  it('delete copy object', function(done) {
    oss.deleteObject({
      bucket: bucket,
      object: 'copy-' + object
    }, function(error, result) {
      result.status.should.equal(204);
      done();
    });
  });

  it('delete object2', function(done) {
    oss.deleteObject({
      bucket: bucket,
      object: object2
    }, function(error, result) {
      result.status.should.equal(204);
      done();
    });
  });

  object = uuid.v4();

  it('put object with userMetas without x-oss', function(done) {
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: __filename,
      userMetas: {
        'Cache-Control': 'max-age=5'
      }
    }, function(error, result) {
      result.status.should.equal(200);
      done();
    });
  });

  it('delete object', function(done) {
    oss.deleteObject({
      bucket: bucket,
      object: object
    }, function(error, result) {
      result.status.should.equal(204);
      done();
    });
  });

  object = uuid.v4();

  it('put object by buffer', function(done) {
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: new Buffer('hello,wolrd', 'utf8')
    }, function(error, result) {
      result.status.should.equal(200);
      done();
    });
  });

  it('delete object', function(done) {
    oss.deleteObject({
      bucket: bucket,
      object: object
    }, function(error, result) {
      result.status.should.equal(204);
      done();
    });
  });

  object = uuid.v4();

  it('put object by stream', function(done) {
    var input = fs.createReadStream(__filename);
    oss.putObject({
      bucket: bucket,
      object: object,
      srcFile: input,
      md5: crypto.createHash('md5').update(fs.readFileSync(__filename, 'utf8')).digest('base64'),
      contentLength: fs.statSync(__filename).size
    }, function(error, result) {
      result.status.should.equal(200);
      done();
    });
  });

  var auth = oss.getUrlAuthorization(bucket, object, 5);
  var path = '/' + object + '?' + auth;

  it('get object by url authorization should success', function(done) {
    get(bucket + '.' + oss.host, path, function(status) {
      status.should.equal(200);
      setTimeout(done, 5000);
    });
  });

  it('get object by url authorization should 403', function(done) {
    get(bucket + '.' + oss.host, path, function(status) {
      status.should.equal(403);
      done();
    });
  });

  it('delete object', function(done) {
    oss.deleteObject({
      bucket: bucket,
      object: object
    }, function(error, result) {
      result.status.should.equal(204);
      done();
    });
  });

  it('delete bucket', function(done) {
    oss.deleteBucket(bucket, function(error, result) {
      should.not.exist(error);
      result.status.should.equal(204);
      done();
    });
  });
});

/**
 * utils
 */
function get(host, path, cb) {
  http.get({
    host: host,
    path: path
  }, function(res) {
    cb(res.statusCode);
  });
}

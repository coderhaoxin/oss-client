'use strict';

var fs = require('fs'),
  http = require('http'),
  path = require('path'),
  crypto = require('crypto'),
  xml2js = require('xml2js'),
  mime = require('mime');

function noop() {}

function OssClient(options) {
  this.accessKeyId = options.accessKeyId;
  this.accessKeySecret = options.accessKeySecret;
  this.host = options.host || 'oss.aliyuncs.com';
  this.port = options.port || '8080';
  this.timeout = options.timeout || 30000000;
  if (options.hasOwnProperty('agent')) {
    this.agent = options.agent;
  } else {
    var agent = new http.Agent();
    agent.maxSockets = 20;
    this.agent = agent;
  }
}

/**
 * get the Authorization header
 * "Authorization: OSS " + AccessId + ":" + base64(hmac-sha1(METHOD + "\n"
 * + CONTENT-MD5 + "\n"
 * + CONTENT-TYPE + "\n"
 * + DATE + "\n"
 * + CanonicalizedOSSHeaders
 * + Resource))
 */
OssClient.prototype.getSign = function(method, contentType, contentMd5, date, metas, resource) {
  var params = [method, contentType || '', contentMd5 || '', date];
  var i, len;

  if (metas) {
    var metaSorted = Object.keys(metas).sort();
    for (i = 0, len = metaSorted.length; i < len; i++) {
      var k = metaSorted[i];
      if (~k.toLowerCase().trim().indexOf('x-oss')) {
        params.push(k.toLowerCase().trim() + ':' + metas[k].trim());
      }
    }
  }

  params.push(resource);

  var basicString = crypto.createHmac('sha1', this.accessKeySecret);
  basicString.update(params.join('\n'));

  return 'OSS ' + this.accessKeyId + ':' + basicString.digest('base64');
};

function getResource(ossParams) {
  var resource = '';

  if (typeof ossParams.bucket === 'string') {
    resource = '/' + ossParams.bucket;
  }
  if (typeof ossParams.object === 'string') {
    resource = resource + '/' + ossParams.object;
  }
  if (typeof ossParams.isAcl === 'boolean') {
    resource = resource + '?acl';
  }
  return resource;
}

OssClient.prototype.getPath = function(ossParams) {
  var params = [],
    path = '';

  if (typeof ossParams.bucket === 'string') {
    path = path + '/' + ossParams.bucket;
  }
  if (typeof ossParams.object === 'string') {
    path = path + '/' + ossParams.object.split('/').map(function(item) {
      return encodeURIComponent(item);
    }).join('/');
  }
  if (typeof ossParams.prefix === 'string') {
    params.push('prefix=' + ossParams.prefix);
  }
  if (typeof ossParams.marker === 'string') {
    params.push('marker=' + ossParams.marker);
  }
  if (typeof ossParams.maxKeys === 'string') {
    params.push('max-keys=' + ossParams.maxKeys);
  }
  if (typeof ossParams.delimiter === 'string') {
    params.push('delimiter=' + ossParams.delimiter);
  }
  if (params.length > 0) {
    path = path + '?' + params.join('&');
  }
  if (typeof ossParams.isAcl === 'boolean') {
    path = path + '?acl';
  }

  return path;
};

OssClient.prototype.getHeaders = function(method, metas, ossParams) {
  var date = new Date().toGMTString(),
    i;

  var headers = {
    Date: date
  };

  if (ossParams.srcFile) {
    headers['content-type'] = ossParams.contentType || mime.lookup(path.extname(ossParams.srcFile));

    if (Buffer.isBuffer(ossParams.srcFile)) {
      headers['content-Length'] = ossParams.srcFile.length;
      var md5 = crypto.createHash('md5');
      md5.update(ossParams.srcFile);
      headers['content-Md5'] = md5.digest('hex');
    } else {
      headers['content-Length'] = ossParams.contentLength;
      if (ossParams.md5) {
        headers['content-Md5'] = ossParams.md5;
      }
    }
  }

  if (ossParams.userMetas) {
    metas = metas || {};
    for (i in ossParams.userMetas) {
      if (ossParams.userMetas.hasOwnProperty(i)) {
        metas[i] = ossParams.userMetas[i];
      }
    }
  }
  for (i in metas) {
    if (metas.hasOwnProperty(i)) {
      headers[i] = metas[i];
    }
  }
  for (i in ossParams.userHeaders) {
    if (ossParams.userHeaders.hasOwnProperty(i)) {
      headers[i] = ossParams.userHeaders[i];
    }
  }

  var resource = getResource(ossParams);
  headers.Authorization = this.getSign(method, headers['content-Md5'], headers['content-type'], date, metas, resource);
  return headers;
};

OssClient.prototype.doRequest = function(method, metas, ossParams, callback) {
  callback = callback || noop;
  var options = {
    method: method,
    host: this.host,
    port: this.port,
    path: this.getPath(ossParams),
    headers: this.getHeaders(method, metas, ossParams),
    timeout: this.timeout,
    agent: this.agent
  };

  var req = http.request(options, function(res) {
    // get a object from oss and save
    if (ossParams.dstFile) {
      var wstream = (typeof ossParams.dstFile === 'string') ? fs.createWriteStream(ossParams.dstFile) : ossParams.dstFile;
      wstream.once('finish', function() {
        callback(null, {
          statusCode: res.statusCode
        });
      });
      wstream.on('error', function(error) {
        callback(error);
      });
      res.pipe(wstream);
    } else if (method === 'HEAD') {
      callback(null, res.headers);
    } else {
      res.setEncoding('utf8');
      res.body = '';

      res.on('data', function(chunk) {
        res.body += chunk;
      });
      res.on('end', function() {
        var parser = new xml2js.Parser();
        parser.parseString(res.body, function(error, result) {
          if (res.statusCode !== 200 && res.statusCode !== 204) {
            var e = new Error(result);
            e.code = res.statusCode;
            callback(e);
          } else if (result) {
            callback(null, result);
          } else {
            // null result
            callback(null, {
              statusCode: res.statusCode
            });
          }
        });
      });
    }
  });

  req.on('error', function(error) {
    callback(error);
  });

  // put file to oss
  if (ossParams.srcFile) {
    if (Buffer.isBuffer(ossParams.srcFile) && method === 'PUT') {
      req.end(ossParams.srcFile);
    } else if (ossParams.srcFile instanceof require('stream')) {
      // stream
      ossParams.srcFile.pipe(req);
    } else if (typeof ossParams.srcFile === 'string') {
      // file path
      fs.createReadStream(ossParams.srcFile).pipe(req);
    }
  } else {
    req.end();
  }
};

/*
 * bucket
 */
OssClient.prototype.createBucket = function(option, callback) {
  /*
   * option: {
   *   bucket:'',
   *   acl:''
   * }
   */
  callback = callback || noop;
  var metas = {
    'X-OSS-ACL': option.acl
  };
  var ossParams = {
    bucket: option.bucket
  };

  this.doRequest('PUT', metas, ossParams, callback);
};

OssClient.prototype.listBucket = function(callback) {
  callback = callback || noop;
  var ossParams = {
    bucket: ''
  };

  this.doRequest('GET', null, ossParams, callback);
};

OssClient.prototype.deleteBucket = function(bucket, callback) {
  callback = callback || noop;
  var ossParams = {
    bucket: bucket
  };

  this.doRequest('DELETE', null, ossParams, callback);
};

OssClient.prototype.getBucketAcl = function(bucket, callback) {
  callback = callback || noop;
  var ossParams = {
    bucket: bucket,
    isAcl: true
  };

  this.doRequest('GET', null, ossParams, callback);
};

OssClient.prototype.setBucketAcl = function(option, callback) {
  /*
   * option: {
   *   bucket:'',
   *   acl:''
   * }
   */
  callback = callback || noop;
  var metas = {
    'X-OSS-ACL': option.acl
  };
  var ossParams = {
    bucket: option.bucket
  };

  this.doRequest('PUT', metas, ossParams, callback);
};

/*
 * object
 */
OssClient.prototype.putObject = function(option, callback) {
  /*
   * option: {
   *   bucket:,
   *   object:,
   *   srcFile:,
   *   contentLength: (if srcFile is stream, this is necessary)
   *   userMetas: {}
   * }
   */
  callback = callback || noop;
  var self = this;

  if (typeof option.srcFile === 'string') {
    // upload by file path
    fs.stat(option.srcFile, function(err, state) {
      if (err) {
        return callback(err);
      }
      option.contentLength = state.size;
      //todo: add option.md5 = ...
      self.doRequest('PUT', null, option, callback);
    });
  } else {
    // upload by buffer or stream
    self.doRequest('PUT', null, option, callback);
  }
};

OssClient.prototype.copyObject = function(option, callback) {
  /*
   * option: {
   *   bucket:,
   *   object:,
   *   srcObject:
   * }
   */
  callback = callback || noop;
  var metas = {
    'x-oss-copy-source': '/' + option.bucket + '/' + option.srcObject
  };

  this.doRequest('PUT', metas, option, callback);
};

OssClient.prototype.deleteObject = function(option, callback) {
  /*
   * option: {
   *   bucket,
   *   object
   * }
   */
  callback = callback || noop;

  this.doRequest('DELETE', null, option, callback);
};

OssClient.prototype.getObject = function(option, callback) {
  /*
   * option: {
   *   bucket,
   *   object,
   *   dstFile,
   *   userHeaders
   *  }
   */
  callback = callback || noop;

  this.doRequest('GET', null, option, callback);
};

OssClient.prototype.headObject = function(option, callback) {
  /*
   * option: {
   *  bucket,
   *  object
   * }
   */
  callback = callback || noop;

  this.doRequest('HEAD', null, option, callback);
};

OssClient.prototype.listObject = function(option, callback) {
  /*
   * option: {
   *   bucket: bucket
   * }
   */
  callback = callback || noop;
  var ossParams = {
    bucket: option.bucket,
    prefix: option.prefix || null,
    marker: option.marker || null,
    delimiter: option.delimiter || null,
    maxKeys: option.maxKeys || null
  };

  this.doRequest('GET', null, ossParams, callback);
};

exports.OssClient = OssClient;
'use strict';

var mime = require('mime-types'),
  assert = require('assert'),
  crypto = require('crypto'),
  xml2js = require('xml2js'),
  http = require('http'),
  fs = require('fs');

function OSS(options) {
  this.accessKeyId = options.accessKeyId;
  this.accessKeySecret = options.accessKeySecret;
  this.host = options.host || 'oss-cn-hangzhou.aliyuncs.com';
  this.port = options.port || 80;
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
OSS.prototype.getSign = function(method, contentType, contentMd5, date, metas, resource) {
  var params = [method, contentType || '', contentMd5 || '', date];

  if (metas) {
    var metaSorted = Object.keys(metas).sort();
    for (var i = 0; i < metaSorted.length; i++) {
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


OSS.prototype.getUrlAuthorization = function (bucket, name, expireMinu) {
  var expireDate = new Date().getTime() + expireMinu * 1000 * 60;
  var basicString = crypto.createHmac('sha1', this.accessKeySecret);
  var str = 'GET\n\n\n' + expireDate + '\n/' + bucket + '/' + name.trim();
  basicString.update(str);
  return 'OSSAccessKeyId=' + this.accessKeyId + '&Expires=' + expireDate + '&Signature=' + basicString.digest('base64');
}


OSS.prototype.getHeaders = function(method, metas, ossParams) {
  var date = new Date().toGMTString();

  var headers = {
    Date: date
  };

  if (ossParams.srcFile) {
    var contentType = ossParams.contentType || mime.lookup(ossParams.srcFile);
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    if (Buffer.isBuffer(ossParams.srcFile)) {
      headers['Content-Length'] = ossParams.srcFile.length;
      var md5 = crypto.createHash('md5').update(ossParams.srcFile);
      headers['Content-Md5'] = md5.digest('base64');
    } else {
      if (ossParams.contentLength) {
        headers['Content-Length'] = ossParams.contentLength;
      }
      if (ossParams.md5) {
        headers['Content-Md5'] = ossParams.md5;
      }
    }
  }

  var i;
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
  headers.Authorization = this.getSign(method, headers['Content-Md5'], headers['Content-Type'], date, metas, resource);
  return headers;
};

OSS.prototype.request = function(method, metas, ossParams, callback) {
  callback = callback || noop;

  var host = this.host;
  if (ossParams.bucket) {
    host = ossParams.bucket + '.' + host;
  }

  var options = {
    method: method,
    host: host,
    port: this.port,
    path: getPath(ossParams),
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
          status: res.statusCode
        });
      });

      wstream.on('error', function(error) {
        callback(error);
      });

      res.pipe(wstream);
    } else if (method === 'HEAD') {
      callback(null, res.headers);
    } else {
      var chunks = [],
        size = 0;

      res.on('data', function(chunk) {
        chunks.push(chunk);
        size += chunk.length;
      });

      res.on('end', function() {
        res.body = Buffer.concat(chunks, size);

        if (!size || res.headers['content-type'] !== 'application/xml') {
          res.status = res.statusCode;
          return callback(null, res);
        }

        var parser = new xml2js.Parser();
        parser.parseString(res.body, function(error, result) {
          if (res.statusCode !== 200 && res.statusCode !== 204) {
            error = new Error();

            try {
              error.status = res.statusCode;
              error.code = result.Error.Code;
              error.message = result.Error.Message;
              error.requestId = result.Error.RequestId;
            } catch (e) {
              error = e;
            }

            return callback(error);
          }

          callback(null, result);
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
OSS.prototype.createBucket = function(option, callback) {
  /*
   * option: {
   *   bucket:'',
   *   acl:''
   * }
   */
  callback = callback || noop;

  var metas = {};
  if (option.acl) {
    metas['X-OSS-ACL'] = option.acl;
  }

  this.request('PUT', metas, option, callback);
};

OSS.prototype.listBucket = function(callback) {
  callback = callback || noop;

  this.request('GET', null, {}, callback);
};

OSS.prototype.deleteBucket = function(bucket, callback) {
  callback = callback || noop;
  var ossParams = {
    bucket: bucket
  };

  this.request('DELETE', null, ossParams, callback);
};

OSS.prototype.getBucketAcl = function(bucket, callback) {
  callback = callback || noop;
  var ossParams = {
    bucket: bucket,
    isAcl: true
  };

  this.request('GET', null, ossParams, callback);
};

OSS.prototype.setBucketAcl = function(option, callback) {
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

  this.request('PUT', metas, option, callback);
};

/*
 * object
 */
OSS.prototype.putObject = function(option, callback) {
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
      self.request('PUT', null, option, callback);
    });
  } else {
    // upload by buffer or stream
    self.request('PUT', null, option, callback);
  }
};

OSS.prototype.copyObject = function(option, callback) {
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

  this.request('PUT', metas, option, callback);
};

OSS.prototype.deleteObject = function(option, callback) {
  /*
   * option: {
   *   bucket,
   *   object
   * }
   */
  callback = callback || noop;

  this.request('DELETE', null, option, callback);
};

OSS.prototype.getObject = function(option, callback) {
  /*
   * option: {
   *   bucket,
   *   object,
   *   dstFile,
   *   userHeaders
   *  }
   */
  callback = callback || noop;

  this.request('GET', null, option, callback);
};

OSS.prototype.headObject = function(option, callback) {
  /*
   * option: {
   *  bucket,
   *  object
   * }
   */
  callback = callback || noop;

  this.request('HEAD', null, option, callback);
};

OSS.prototype.listObject = function(option, callback) {
  /*
   * option: {
   *   bucket: '',
   *   prefix: '',
   *   marker: '',
   *   delimiter: '',
   *   maxKeys: ''
   * }
   */
  callback = callback || noop;

  this.request('GET', null, option, callback);
};

/**
 * exports
 */
exports.create = function(options) {
  assert(typeof options === 'object', 'invalid options');

  var client = new OSS(options);

  var wrapper = options.wrapper;
  if (wrapper) {
    require('thunkify-or-promisify')(client, wrapper, ['request', 'getSign', 'getHeaders']);
  }

  return client;
};

/**
 * utils
 */
function noop() {}

function getResource(ossParams) {
  var resource = '';

  if (ossParams.bucket) {
    resource = '/' + ossParams.bucket;
  }
  if (ossParams.object) {
    resource += '/' + ossParams.object;
  } else {
    resource += '/';
  }
  if (ossParams.isAcl) {
    resource += '?acl';
  }

  return resource;
}

function getPath(ossParams) {
  var params = [],
    path = '';

  if (ossParams.object) {
    path += '/' + encodeURIComponent(ossParams.object);
  }
  if (ossParams.prefix) {
    params.push('prefix=' + encodeURIComponent(ossParams.prefix));
  }
  if (ossParams.marker) {
    params.push('marker=' + encodeURIComponent(ossParams.marker));
  }
  if (ossParams.maxKeys) {
    params.push('max-keys=' + ossParams.maxKeys);
  }
  if (ossParams.delimiter) {
    params.push('delimiter=' + encodeURIComponent(ossParams.delimiter));
  }
  if (params.length > 0) {
    path += '/?' + params.join('&');
  }
  if (ossParams.isAcl) {
    path += '/?acl';
  }

  return path;
}

var fs     = require('fs');
var path   = require('path');
var util   = require('util');
var crypto = require('crypto');
var Buffer = require("buffer").Buffer;

var request = require('request');
var xml2js  = require('xml2js');
var async   = require('async');
var mime    = require('mime');

function OssClient (options) {
  this.accessKeyId = options.accessKeyId;
  this.accessKeySecret = options.accessKeySecret;
  this.host = "oss.aliyuncs.com";
  this.port = "8080";
  this.timeout = options.timeout || 30000000;
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
OssClient.prototype.getSign = function (method, contentType, contentMd5, date, metas, resource) {
  var params = [ method, contentType || '', contentMd5 || '', date ];
  var i, len;

  // sort the metas
  if (metas) {
    var metaSorted = Object.keys(metas).sort();
    for(i = 0, len = metaSorted.length; i < len; i++) {
      var k = metaSorted[i];
      params.push(k.toLowerCase() + ':' + metas[k]);
    }
  }

  params.push(resource);

  var basicString = crypto.createHmac('sha1', this.accessKeySecret);
  basicString.update(params.join('\n'));

  return 'OSS ' + this.accessKeyId + ':' + basicString.digest('base64');
};

OssClient.prototype.getResource = function (ossParams){
  var resource = '';

  if (typeof ossParams['bucket'] === 'string') {
    resource = '/' + ossParams['bucket'];
  }
  if (typeof ossParams['object'] === 'string') {
    resource = resource + '/' + ossParams['object'];
  }
  if (typeof ossParams['isAcl'] === 'boolean') {
    resource = resource + '?acl';
  }
  return resource;
};

OssClient.prototype.getUrl = function (ossParams) {
  var url = 'http://' + this.host + ':' + this.port;
  var params = [];
  if (typeof ossParams['bucket'] === 'string') {
    url = url + '/' + ossParams['bucket'];
  }
  if (typeof ossParams['object'] === 'string') {
    url = url + '/' + ossParams['object'].split("/").map(function (item) {
      return encodeURIComponent(item);
    }).join("/");
  }
  if (typeof ossParams['prefix'] === 'string') {
    params.push('prefix=' + ossParams['prefix']);
  }
  if (typeof ossParams['marker'] === 'string') {
    params.push('marker=' + ossParams['marker']);
  }
  if (typeof ossParams['maxKeys'] === 'string') {
    params.push('max-keys=' + ossParams['maxKeys']);
  }
  if (typeof ossParams['delimiter'] === 'string') {
    params.push('delimiter='+ ossParams['delimiter']);
  }
  if (params.length > 0) {
    url = url + '?' + params.join('&');
  }
  if (typeof ossParams['isAcl'] === 'boolean') {
    url = url + '?acl';
  }

  return url;
};

OssClient.prototype.getHeaders = function (method, metas, ossParams) {
  var date = new Date().toGMTString();
  var i;

  var headers = {
    Date: date
  };

  if (ossParams.srcFile) {
    var md5 = crypto.createHash('md5');
    headers['content-type'] = mime.lookup(path.extname(ossParams.srcFile));
    if(Buffer.isBuffer(ossParams.srcFile)) {
      headers['content-Length'] = ossParams.srcFile.length;
      md5.update(ossParams.srcFile);
      headers['content-Md5'] = md5.digest('hex');
    } else if(ossParams.srcFile instanceof require("stream")) {
      headers['content-Length'] = ossParams.contentLength;
      if(ossParams.md5) {
        headers['content-Md5'] = ossParams.md5;
      }
    } else {
      headers['content-Length'] = fs.statSync(ossParams.srcFile).size;
      //TODO: seems dangerous to calculate MD5 using sync methods,remove sync methods
      md5.update(fs.readFileSync(ossParams.srcFile));
      headers['content-Md5'] = md5.digest('hex');
    }
  }
  if (ossParams.userMetas) {
    metas = metas || {};
    for (i in ossParams.userMetas) {
      if(ossParams.userMetas.hasOwnProperty(i)) {
        metas[i] = ossParams.userMetas[i];
      }
    }
  }
  for (i in metas) {
    if(metas.hasOwnProperty(i)) {
      headers[i] = metas[i];
    }
  }
  for (i in ossParams.userHeaders) {
    if(ossParams.userHeaders.hasOwnProperty(i)) {
      headers[i] = ossParams.userHeaders[i];
    }
  }

  var resource = this.getResource(ossParams);
  headers['Authorization'] = this.getSign(method, headers['content-Md5'], headers['content-type'], date, metas, resource);
  return headers;
};

OssClient.prototype.doRequest = function (method, metas, ossParams, callback) {
  var options = {};
  callback = callback || function () {};
  options.method = method;
  options.url = this.getUrl(ossParams);
  options.headers = this.getHeaders(method, metas, ossParams);
  options.timeout = this.timeout;

  if (Buffer.isBuffer(ossParams.srcFile) && method === 'PUT') {
    options.body = ossParams.srcFile;
  }

  var req = request(options, function (error, response, body) {
    if (error) {
      return callback(error);
    }
    if (response.statusCode !== 200 && response.statusCode !== 204) {
      var e = new Error(body);
      e.code = response.statusCode;
      return callback(e);
    }
    // if we should write the body to a file, we will do it later
    if (body && !ossParams.dstFile) {
      var parser = new xml2js.Parser();
      parser.parseString(body, function(error, result) {
        callback(error, result);
      });
    } else if (method === 'HEAD') {
      callback(error, response.headers);
    } else {
      callback(null, { statusCode: response.statusCode });
    }
  });

  // put file to oss
  if (ossParams.srcFile) {
    var rstream;
    if (ossParams.srcFile instanceof require('stream')) {
      // stream
      rstream = ossParams.srcFile;
    } else if (typeof ossParams.srcFile === 'string') {
      // file path
      rstream = fs.createReadStream(ossParams.srcFile);
    }
    if (rstream) {
      rstream.pipe(req);
    }
  }
  // get a object from oss and save as a file
  if (ossParams.dstFile) {
    var wstream = (typeof ossParams.dstFile === "string") ? fs.createWriteStream(ossParams.dstFile) : ossParams.dstFile;
    req.pipe(wstream);
  }
};

/*********************/
/** bucket operater **/
/*********************/
OssClient.prototype.createBucket = function (bucket, acl, callback) {
  callback = callback || function () {};

  var method = 'PUT';
  var metas = { 'X-OSS-ACL': acl };
  var ossParams = {
    bucket: bucket
  };
  this.doRequest(method, metas, ossParams, callback);
};

OssClient.prototype.listBucket = function (callback) {
  callback = callback || function () {};
  var method = 'GET';
  var ossParams = {
    bucket: ''
  };

  this.doRequest(method, null, ossParams, callback);
};

OssClient.prototype.deleteBucket = function (bucket, callback) {
  callback = callback || function () {};

  var method = 'DELETE';
  var ossParams = {
    bucket: bucket
  };

  this.doRequest(method, null, ossParams, callback);
};

OssClient.prototype.getBucketAcl = function (bucket, callback) {
  callback = callback || function () {};

  var method = 'GET';
  var ossParams = {
    bucket: bucket,
    isAcl: true
  };

  this.doRequest(method, null, ossParams, callback);
};

OssClient.prototype.setBucketAcl = function (bucket, acl, callback) {
  callback = callback || function () {};

  var method = 'PUT';
  var metas = {'X-OSS-ACL': acl};
  var ossParams = {
    bucket: bucket
  };

  this.doRequest(method, metas, ossParams, callback);
};

/*********************/
/** object operater **/
/*********************/
OssClient.prototype.putObject = function (option, callback) {
  /*
  * option: {
  *   bucket:,
  *   object:,
  *   srcFile:,
  *   userMetas:
  * }
  */
  callback = callback || function () {};

  var self = this;
  var method = 'PUT';

  if(typeof option.srcFile === "string") {
    fs.stat(option.srcFile, function(err/*, stats*/) {
      if (err) {
        return callback(err);
      }
      self.doRequest(method, null, option, callback);
    });
  } else {
    self.doRequest(method, null, option, callback);
  }

};

OssClient.prototype.copyObject = function (option, callback) {
  /*
  * option: {
  *   bucket:,
  *   object:,
  *   srcObject:
  * }
  */
  callback = callback || function () {};

  var method = 'PUT';
  var metas = {'x-oss-copy-source': '/' + option.bucket + '/' + option.srcObject};

  this.doRequest(method, metas, option, callback);
};

OssClient.prototype.deleteObject = function (option, callback) {
  /*
  * option: {
  *   bucket,
  *   object
  * }
  */
  callback = callback || function () {};

  var method = 'DELETE';

  this.doRequest(method, null, option, callback);
};

OssClient.prototype.getObject = function (option, callback) {
  /*
  * option: {
  *   bucket,
  *   object,
  *   dstFile,
  *   userHeaders
  *  }
  */
  callback = callback || function () {};

  var method = 'GET';

  this.doRequest(method, null, option, callback);
};

OssClient.prototype.headObject = function (option, callback) {
  /*
  * option: {
  *  bucket,
  *  object
  * }
  */
  callback = callback || function () {};

  var method = 'HEAD';

  this.doRequest(method, null, option, callback);
};

OssClient.prototype.listObject = function (option, callback) {
  /*
  * option: {
  *   bucket: bucket
  * }
  */
  callback = callback || function () {};

  var method = 'GET';

  var ossParams = {};
  ossParams.bucket = option.bucket;
  ossParams.prefix = option.prefix || null;
  ossParams.marker = option.marker || null;
  ossParams.delimiter = option.delimiter || null;
  ossParams.maxKeys = option.maxKeys || null;

  this.doRequest(method, null, ossParams, callback);
};

exports.OssClient = OssClient;

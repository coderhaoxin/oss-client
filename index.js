var fs = require('fs');
var path = require('path');
var util = require('util');
var crypto = require('crypto');
var Buffer = require("buffer").Buffer;

var xml2js = require('xml2js');
var request = require('request');
var mime = require('mime');

var noop = function (error) {};

function OssClient (options) {
  this._accessId = options.accessKeyId;
  this._accessKey = options.accessKeySecret;
  this._host = "oss.aliyuncs.com";
  this._port = "8080";
  this._timeout = 30000000;
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
  var params = [
    method,
    contentType || '',
    contentMd5 || '',
    date
  ];
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

  var basicString = crypto.createHmac('sha1', this._accessKey);
  basicString.update(params.join('\n'));

  return 'OSS ' + this._accessId + ':' + basicString.digest('base64');
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
  if (typeof ossParams['isGroup'] === 'boolean') {
    resource = resource + '?group';
  }
  return resource;
};

OssClient.prototype.getUrl = function (ossParams) {
  var url = 'http://' + this._host + ':' + this._port;
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
  if (typeof ossParams['isGroup'] === 'boolean') {
    url = url + '?group';
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
      //TODO: seems dangerous to calculate MD5 using sync methods
      md5.update(fs.readFileSync(ossParams.srcFile));
      headers['content-Md5'] = md5.digest('hex');
    }
  }
  if (ossParams.isGroup) {
    headers['content-type'] = "txt/xml";
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
  callback = callback || noop;
  options.method = method;
  options.url = this.getUrl(ossParams);
  options.headers = this.getHeaders(method, metas, ossParams);
  options.timeout = this._timeout;

  if (ossParams.isGroup) {
    options.body = this.getObjectGroupPostBody(ossParams.bucket, ossParams.objectArray);
  }

  if(Buffer.isBuffer(ossParams.srcFile) && method === 'PUT') {
    options.body = ossParams.srcFile;
  }
  var req = request(options, function (error, response, body) {
    if (error) {
      return callback(error);
    }
    if (response.statusCode !== 200 && response.statusCode !== 204) {
      var e = new Error(body);
      e.code = response.statusCode;
      callback(e);
    } else {
      // if we should write the body to a file, we will do it later
      if (body && !ossParams.dstFile) {
        var parser = new xml2js.Parser();
        parser.parseString(body, function(error, result) {
          callback(error, result);
        });
      } else if (method === 'HEAD') {
        callback(error, response.headers);
      } else {
        callback(null, {
          statusCode: response.statusCode
        });
      }
    }
  });

  // put a file to oss
  if (ossParams.srcFile) {
    var rstream;
    if(ossParams.srcFile instanceof require("stream")) {//stream
      rstream = ossParams.srcFile;
    } else if(typeof ossParams.srcFile === "string") {//file path
      rstream = fs.createReadStream(ossParams.srcFile);
    }
    if(rstream) {//if srcFile is a buffer, it will not enter
      rstream.pipe(req);
    }
  }
  // get a object from oss and save as a file
  if (ossParams.dstFile) {
    var wstream = typeof ossParams.dstFile === "string" ? fs.createWriteStream(ossParams.dstFile) : ossParams.dstFile;
    req.pipe(wstream);
  }
};

/*********************/
/** bucket operater **/
/*********************/
OssClient.prototype.createBucket = function (bucket, acl, callback) {
  if (!bucket || !acl) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'PUT';
  var metas = {'X-OSS-ACL': acl};
  var ossParams = {
    bucket: bucket
  };
  this.doRequest(method, metas, ossParams, callback);
};

OssClient.prototype.listBucket = function (callback) {
  var method = 'GET';
  var ossParams = {
    bucket: ''
  };

  this.doRequest(method, null, ossParams, callback);
};

OssClient.prototype.deleteBucket = function (bucket, callback) {
  if (!bucket) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'DELETE';
  var ossParams = {
    bucket: bucket
  };

  this.doRequest(method, null, ossParams, callback);
};

OssClient.prototype.getBucketAcl = function (bucket, callback) {
  if (!bucket) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'GET';
  var ossParams = {
    bucket: bucket,
    isAcl: true
  };

  this.doRequest(method, null, ossParams, callback);
};

OssClient.prototype.setBucketAcl = function (bucket, acl, callback) {
  if (!bucket || !acl) {
    return callback(new Error('invalid arguments'));
  }

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
  callback = callback || noop;
  if (!option || !option.bucket || !option.object || !option.srcFile) {
    return callback(new Error('invalid arguments'));
  }

  var self = this;
  var method = 'PUT';
  // var thisArguments = arguments;
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
  if (!option || !option.bucket || !option.object || !option.srcObject) {
    return callback(new Error('invalid arguments'));
  }

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
  if (!option || !option.bucket || !option.object) {
    return callback(new Error('invalid arguments'));
  }

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
  if (!option || !option.bucket || !option.object || !option.dstFile) {
    return callback(new Error('invalid arguments'));
  }

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
  if (!option || !option.bucket || !option.object) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'HEAD';

  this.doRequest(method, null, option, callback);
};

OssClient.prototype.listObject = function (option, callback) {
  /*
  * option: {
  *   bucket: bucket
  * }
  */
  if (!option || !option.bucket) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'GET';

  var ossParams = {};
  ossParams.bucket = option.bucket;
  ossParams.prefix = option.prefix || null;
  ossParams.marker = option.marker || null;
  ossParams.delimiter = option.delimiter || null;
  ossParams.maxKeys = option.maxKeys || null;

  this.doRequest(method, null, ossParams, callback);
};

/***************************/
/** object group operater **/
/***************************/
OssClient.prototype.getObjectEtag = function (object) {
  var md5 = crypto.createHash('md5');
  md5.update(fs.readFileSync(object));
  return md5.digest('hex').toUpperCase();
};

OssClient.prototype.getObjectGroupPostBody = function (bucket, objectArray, callback) {
  //TODO: bucket, callback is nerver used?
  var xml = '<CreateFileGroup>';
  var index = 0;
  var i;

  for (i in objectArray) {
    if (objectArray.hasOwnProperty(i)) {
      index ++;
      var etag = this.getObjectEtag(objectArray[i]);
      xml += '<Part>';
      xml += '<PartNumber>' + index + '</PartNumber>';
      xml += '<PartName>' + objectArray[i] + '</PartName>';
      xml += '<ETag>' + etag + '</ETag>';
      xml += '</Part>';
    }
  }

  xml += '</CreateFileGroup>';
  return xml;
};

OssClient.prototype.createObjectGroup = function (option, callback) {
  /*
  * option: {
  *   bucket,
  *   object,
  *   objectArray
  * }
  */
  if (!bucket || !object || !objectArray) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'POST';
  option.isGroup = true;

  this.doRequest(method, null, option, callback);
};

OssClient.prototype.getObjectGroup = function (option, callback) {
  /*
  * option: {
  *   bucket,
  *   object,
  *   dstFile
  * }
  */
  if (!option || !option.bucket || !option.object || !option.dstFile) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'GET';
  option.isGroup = true;

  this.doRequest(method, null, option, callback);
};

OssClient.prototype.getObjectGroupIndex = function (option, callback) {
  /*
  * option: {
  *   bucket,
  *   object
  * }
  */
  if (!option || !option.bucket || !option.object) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'GET';
  var metas = {'X-OSS-FILE-GROUP': ''};

  this.doRequest(method, metas, option, callback);
};

OssClient.prototype.headObjectGroup = function (option, callback) {
  /*
  * option: {
  *   bucket,
  *   object
  * }
  */
  if (!option || !option.bucket || !option.object) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'HEAD';

  this.doRequest(method, null, option, callback);
};

OssClient.prototype.deleteObjectGroup = function (option, callback) {
  /*
  * option: {
  *   bucket,
  *   object
  * }
  */
  if (!option || !option.bucket || !option.object) {
    return callback(new Error('invalid arguments'));
  }

  var method = 'DELETE';

  this.doRequest(method, null, option, callback);
};

exports.OssClient = OssClient;

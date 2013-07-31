var Buffer = require('buffer').Buffer;

var ossAPI = require('../index');
var option = require('./config').option;
var oss = new ossAPI.OssClient(option);

var bucket = require('./config').bucket;
var object = Date.now().toString();

oss.putObject({
  bucket: bucket,
  object: object,
  srcFile: new Buffer("hello,wolrd", "utf8")
}, function(error, result) {
  console.log(error, result);
});

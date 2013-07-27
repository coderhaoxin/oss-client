var ossApi = require('../index');
// var domain = require("domain");
var Buffer = require('buffer').Buffer;
var option = require('./config').option;
var bucket = '';
var object = Date.now().toString();

var oss = new ossApi.OssClient(option);
// var d = domain.create();

oss.putObject({
  bucket: bucket,
  object: object,
  srcFile: new Buffer("hello,wolrd", "utf8")
}, function(e, response) {
  console.log(e, response);
});

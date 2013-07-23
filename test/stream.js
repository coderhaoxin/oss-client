/*global __filename */

var fs = require("fs");
var ossApi = require('../index');
// var domain = require("domain");
var option = {
  accessKeyId: '',
  accessKeySecret: ''
};
var bucket = '';
var object = Date.now().toString();

var oss = new ossApi.OssClient(option);
// var d = domain.create();
var input = fs.createReadStream(__filename);

oss.putObject({
  bucket: bucket,
  object: object,
  srcFile: input,
  contentLength: fs.statSync(__filename).size
}, function(e, response) {
  console.log(e, response);
});
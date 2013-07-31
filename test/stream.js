var fs = require("fs");

var ossAPI = require('../index');
var option = require('./config').option;
var oss = new ossAPI.OssClient(option);

var bucket = require('./config').bucket;;
var object = Date.now().toString();

var input = fs.createReadStream(__filename);

oss.putObject({
  bucket: bucket,
  object: object,
  srcFile: input,
  contentLength: fs.statSync(__filename).size
}, function(error, result) {
  console.log(error, result);
});

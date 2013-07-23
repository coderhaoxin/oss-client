/*global __dirname, __filename */

var ossApi = require('../index');
var domain = require("domain");
var option = {
  accessKeyId: '',
  accessKeySecret: ''
};
var bucket = '';
var object = Date.now().toString();


var oss = new ossApi.OssClient(option);
var d = domain.create();

// oss.putObject('catworks-test', Date.now().toString(), __dirname + '/index.js');
oss.putObject({
  bucket: bucket,
  object: object,
  srcFile: __filename,
  userMetas: {
    "x-oss-meta-foo": "bar"
  }
}, d.intercept(function(result) {
  console.log(result);
  oss.headObject(bucket, object, d.intercept(function(headers) {
    console.log(headers);
    oss.listObject(bucket, d.intercept(function(list) {
      console.log(list.ListBucketResult);
      oss.deleteObject({
        bucket: bucket,
        object: object
      }, d.intercept(function(result) {
        console.log(result);
      }));
    }));
  }));
}));

d.on("error", function(e) {
  console.error(e);
});
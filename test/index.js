var ossApi = require('../index');
var option = {
  accessKeyId: '',
  accessKeySecret: ''
};

var oss = new ossApi.OssClient(option);

oss.putObject('', '', __dirname + '/index.js');

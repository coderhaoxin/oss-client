### a node.js module to connect aliyun oss
```bash
npm install oss-client
```

### other contributors
* [@RobinQu](https://github.com/RobinQu)

1.用例
```js
var ossAPI = require('oss-client');
var option = {
  accessKeyId: 'your access key id',
  accessKeySecret: 'your access key secret'
};

var oss = new ossAPI.OssClient(option);
```

参数说明：
```js
{
  bucket: 'bucket name',
  object: 'object name',
  acl: 'bucket 访问规则',
  objectGroup: 'objectGroup name'
}
```

### bucket

列出所有bucket
```js
listBucket(callback(err){})
```

创建bucket
```js
createBucket(bucket, acl, callback(err){})
```

删除bucket
```js
deleteBucket(bucket, callback(err){})
```

获取bucket访问规则
```js
getBucketAcl(bucket, callback(err, result){})
```

设置bucket访问规则
```js
setBucketAcl(bucket, acl, callback(err){})
```

### object

创建object
```js
// srcFile: 上传的文件路径
// userMetas: 可选，object类型，用户自定义header，如x-oss-meta-location
putObject({
  bucket: bucket,
  object: object,
  srcFile: srcFile,
  userMetas: userMetas //optional
}, callback(err) {})
```

复制object
```js
copyObject({
  bucket: bucket,
  object: object,
  srcObject: srcObject
}, callback(err) {})
```

删除object
```js
deleteObject({
  bucket: bucket,
  object: object
}, callback(err) {})
```

获取object
```js
// dstFile: 保存object的文件路径
// userHeaders: 可选，object类型，用户自定义header，如If-Unmodified-Since
getObject({
  bucket: bucket,
  object: object,
  dstFile: dstFile,
  userHeaders: userHeaders
}, callback(err) {})
```

获取object头信息
```js
headObject({
  bucket: bucket,
  object: object
}, callback(err, result) {})
```

获取object列表
```js
// prefix: 可选，object 前缀
// marker: 可选，列表起始object
// delimiter: 可选，object分组字符，若'/'为则不列出路径深度大于等于二层的object。
// maxKeys: 可选， 列出的object最大个数
listObject({
  bucket: bucket,
  prefix: prefix,
  marker: marker,
  delimiter: delimiter,
  maxKeys: maxKeys
}, callback(err, result) {})
```

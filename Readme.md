[![NPM version][npm-img]][npm-url]
[![License][license-img]][license-url]
[![Dependency status][david-img]][david-url]

### oss-client
a node.js module to connect aliyun oss, friendly with **co**, **koa** ...

```bash
npm install oss-client
```

[aliyun oss document](http://imgs-storage.cdn.aliyuncs.com/help/oss/OSS_API_20131015.pdf?spm=5176.383663.5.23.OEtIjV&file=OSS_API_20131015.pdf)

### how to use
```js
var OSS = require('oss-client');
var option = {
  accessKeyId: 'access key id',
  accessKeySecret: 'access key secret'
};

/*
 * host - default: oss.aliyuncs.com
 * port - default: 8080
 * timeout - default: 30000000
 * agent - default: agent.maxSockets = 20
 */

var oss = OSS.create(option);
```

参数说明：
```js
{
  bucket: 'bucket name',
  object: 'object name',
  acl: 'bucket 访问规则'
}
```

### object

创建object(by: file path)
```js
/*
 * srcFile: 上传的文件路径
 * userMetas: 可选，object类型，用户自定义header，如: x-oss-meta-location
 */
putObject({
  bucket: bucket,
  object: object,
  srcFile: srcFile,
  userMetas: userMetas //optional
}, function (err) {});
```

创建object(by: buffer)
```js
/*
 * userMetas: 可选，object类型，用户自定义header，如: x-oss-meta-location
 * contentType: 可选，但推荐添加(buffer无法自动获取contentType)
 */

oss.putObject({
  bucket: bucket,
  object: object,
  srcFile: new Buffer("hello,wolrd", "utf8"),
  contentType: 'image/jpeg'
}, function (error, result) {});
```

创建object(by: stream)
```js
/*
 * userMetas: 可选，object类型，用户自定义header，如: x-oss-meta-location
 */
var input = fs.createReadStream(__filename);
oss.putObject({
  bucket: bucket,
  object: object,
  srcFile: input,
  contentLength: fs.statSync(__filename).size
}, function (error, result) {});
```

复制object
```js
copyObject({
  bucket: bucket,
  object: object,
  srcObject: srcObject
}, function (err) {});
```

删除object
```js
deleteObject({
  bucket: bucket,
  object: object
}, function (err) {});
```

获取object
```js
/*
 * dstFile: 保存object的文件路径
 * userHeaders: 可选，object类型，用户自定义header，如 If-Unmodified-Since
 */
getObject({
  bucket: bucket,
  object: object,
  dstFile: dstFile,
  userHeaders: userHeaders
}, function (err) {});
```

获取object头信息
```js
headObject({
  bucket: bucket,
  object: object
}, function (err, result) {});
```

获取object列表
```js
/*
 * prefix: 可选，object 前缀
 * marker: 可选，列表起始object
 * delimiter: 可选，object分组字符，若为 '/' 则不列出路径深度大于等于二层的object
 * maxKeys: 可选， 列出的object最大个数
 */
listObject({
  bucket: bucket,
  prefix: prefix,
  marker: marker,
  delimiter: delimiter,
  maxKeys: maxKeys
}, function (err, result) {});
```

### bucket

列出所有bucket
```js
listBucket(function (err) {});
```

创建bucket
```js
createBucket({
  bucket: bucket,
  acl: acl
}, function (err) {});
```

删除bucket
```js
deleteBucket(bucket, function (err) {});
```

获取bucket访问规则
```js
getBucketAcl(bucket, function (err, result) {});
```

设置bucket访问规则
```js
setBucketAcl({
  bucket: bucket,
  acl: acl
}, function (err) {});
```

### utils

getUrlAuthorization - 在 URL 中包含签名
```js
var auth = getUrlAuthorization(bucket, object, expireSecond);
// http://bucket.oss-cn-hangzhou.aliyuncs.com/object?auth
```

### use with `co` or `koa`

```js
var option = {
  wrapper: 'thunk', // or: promise
  accessKeyId: '',
  accessKeySecret: ''
};

var oss = OSS.create(option);

// in co or koa
yield oss.listBucket();
```

### Coverage
97%

### License
MIT

[npm-img]: https://img.shields.io/npm/v/oss-client.svg?style=flat-square
[npm-url]: https://npmjs.org/package/oss-client
[license-img]: https://img.shields.io/badge/license-MIT-green.svg?style=flat-square
[license-url]: http://opensource.org/licenses/MIT
[david-img]: https://img.shields.io/david/coderhaoxin/oss-client.svg?style=flat-square
[david-url]: https://david-dm.org/coderhaoxin/oss-client

const path = require('path');
const gulpUtil = require('gulp-util');
const PluginError = gulpUtil.PluginError;
const colors = gulpUtil.colors;
const log = gulpUtil.log;
const ALY = require('aliyun-sdk');
const moment = require('moment');
const mime = require('mime');
const AliCdnSDK = require('ali-cdn-sdk');
const es = require('event-stream');

const PLUGIN_NAME = 'gulp-oss';

const oss = function (options) {
  const version = moment().format('YYMMDDHHmm');
  if (!option) {
    throw new PluginError(PLUGIN_NAME, 'Missing option!');
  }
  if (!option.bucket) {
    throw new PluginError(PLUGIN_NAME, 'Missing option.bucket!');
  }
  return es.map(function (file, finished) {
    if (!file.isBuffer()) {
      finished(null, file);
      return;
    }

    var ossClient = new ALY.OSS({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      endpoint: options.endpoint,
      apiVersion: options.apiVersion
    });
    const getFileKey = function (file) {
      return options.prefix
          + ((!options.prefix || (options.prefix[options.prefix.length - 1]) === '/') ? '' : '/')
          + (options.versioning ? version + '/' : '')
          + path.relative(file.base, file.path);
    };
    const fileKey = getFileKey(file);
    ossClient.putObject({
          Bucket: options.bucket,
          Key: fileKey,
          Body: file.contents,
          AccessControlAllowOrigin: '',
          ContentDisposition: '',
          ServerSideEncryption: 'AES256',
          ContentType: mime.lookup(fileKey)
        }, function (err, data) {
          if (err) {
            log('ERR:', colors.red(fileKey + "\t" + err.code));
            finished(err, null)
          } else {
            log('OK:', colors.green(fileKey));
            finished(null, file)
          }
        }
    );
  });
};

oss.refreshCDN = function (options) {
  if (options.refreshCDN === null || options.refreshCDN.trim() === '') {
    log('WARN:', colors.yellow('No refreshCDN given, RefreshObjectCaches skipped,'));
    return;
  }

  if (options.refreshCDN instanceof Array) {
    options.refreshCDN.join("\n");
  }
  const cdnSDK = new AliCdnSDK({
    accessKeyId: options.accessKeyId,
    appSecret: options.secretAccessKey,
    endpoint: 'https://cdn.aliyuncs.com',
    apiVersion: '2014-11-11'
  });
  return new Promise(function (resolve, reject) {
    cdnSDK.RefreshObjectCaches({
      ObjectPath: options.refreshCDN,
      ObjectType: 'Directory'
    }).then(function (res) {
      resolve(res);
      log('OK:', colors.green('CDN refreshed successfully:'), res);
    }).catch(reject);
  });
}

module.exports = oss;

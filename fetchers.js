#!usr/bin/env node

const https = require('https');
const querystring = require('querystring');

/**
 * Get data from target webpage as defined in options
 * @param object options
 */
const getData = function (options) {
  return new Promise (function (resolve, reject) {
      https.get(options, function(resp) {
        resp.setEncoding('utf8');
        let data = "";

        resp.on('data', function(chunk) {
          data += chunk;
        });

        resp.on('end', function() {
          resolve(data);
        })
      }).on("error", function (err) {
        reject(err);
    });
  });
}

/**
 * Construct url path and query params then constructPath
 * @param string mode
 * @param int pageNo
 */
const constructPath = function (mode, pageNo) {
  params = {
    'mode': mode,
    'c_page': pageNo
  }
  return "/market-directory/results?" + querystring.stringify(params)
}

module.exports = {
  getData,
  constructPath
}

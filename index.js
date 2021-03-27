#!usr/bin/env node
const querystring = require('querystring');
const fs = require('fs');
const https = require('https');
const jsdom = require('jsdom');
const xpath = require('xpath-html')

const { JSDOM } = jsdom;
const { readFileSync, writeFileSync, appendFileSync } = fs;

const outputFile = process.argv[2]
const mapping = JSON.parse(fs.readFileSync('field_mappings.json', 'utf-8'));

/**
 * Get data from target webpage as defined in options
 * @param object options
 */
function getData(options) {
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
 * Take jsdoc document parse list of relevant 'Li's from it
 * (as relevant to DOM structure of 'ldc.lloyds.com/marketdirectory')
 * @param object doc
 */
function parseDataList(doc) {
  let tab = doc.getElementById('CoverholderTabDetails');

  return doc.querySelectorAll('.marketing-directories-results > ul > li');
}

/**
 * Function to return the total number of pages to access
 * @param object doc
 */
function getNoPages(doc) {
  let noPages = doc.querySelector('#CoverholderTabDetails .table-listing-list-pagination-pages > li:last-child > a').innerHTML;

  return parseInt(noPages);
}

/**
 * Function to check and wipe existing file
 * @param string outputFile
 * @param array mapping
 */
function prepareOutputFile(outputFile, mapping) {
  try {
    // Check whether file exists and whether populated already
    let fileContents = readFileSync(outputFile);
    if (fileContents.length) {
      // Empty file contents if already populated
      writeFileSync(outputFile, "")
    }
    let headings = mapping.map(item => item['name']);
    appendFileSync(outputFile, headings.join());
  } catch (err) {
    console.error(err);
  }
}

/**
 * Construct url path and query params then constructPath
 * @param string mode
 * @param int pageNo
 */
function constructPath(mode, pageNo) {
  params = {
    'mode': mode,
    'page': pageNo
  }
  return "/market-directory/results?" + querystring.stringify(params)
}

prepareOutputFile(outputFile, mapping);

let options = {
  hostname: "ldc.lloyds.com",
  path: constructPath('cov', 1),
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};

getData(options)
.then(function(result) {
  console.log("Initial request success");
  let dom = new JSDOM(result);
  let doc = dom.window.document;

  let totalPages = getNoPages(doc);
  console.log(`Total pages: ${totalPages}`)

  for (let i = 1; i <= totalPages; i++) {
    let options = {
      hostname: "ldc.lloyds.com",
      path: constructPath('cov', i),
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    };
    let list;

    getData(options)
    .then(function(result) {
      console.log(`${options.hostname}/${options.path} success\n`);
      let dom = new JSDOM(result);
      let doc = dom.window.document;

      list = parseDataList(doc);

      list.forEach(function (listItem) {
        let fieldValues = [];

        mapping.forEach(function(field) {
          let querySpace = xpath.fromPageSource(listItem.outerHTML);
          let text = querySpace.findElement(field['selector']);
          fieldValues.push(text);
        })
        appendFileSync(fieldValues.join());
      });
    })
    .catch(function (reason) {
      console.error(`Failed to get page: ${reason} with options:`);
      console.error(options);
    })
  }
})
.catch(function (reason) {
  console.error(`Failed to get page: ${reason} with options:`);
  console.error(options);
})
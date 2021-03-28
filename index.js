#!usr/bin/env node
const querystring = require('querystring');
const fs = require('fs');
const https = require('https');
const jsdom = require('jsdom');
const cheerio = require('cheerio');
const fetchers = require('./fetchers.js');
const { JSDOM } = jsdom;
const { readFileSync, writeFileSync, appendFileSync } = fs;

const outputFile = process.argv[2]
const mapping = JSON.parse(fs.readFileSync('field_mappings.json', 'utf-8'));

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
    appendFileSync(outputFile, headings.join() + "\n");
  } catch (err) {
    console.error(err);
  }
}

prepareOutputFile(outputFile, mapping);

let options = {
  hostname: "ldc.lloyds.com",
  path: fetchers.constructPath('cov', 1),
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};

fetchers.getData(options)
.then(function(result) {
  console.log("Initial request success");
  let dom = new JSDOM(result);
  let doc = dom.window.document;

  let totalPages = getNoPages(doc);
  console.log(`Total pages: ${totalPages}`)

  for (let i = 1; i <= totalPages; i++) {
    let options = {
      hostname: "ldc.lloyds.com",
      path: fetchers.constructPath('cov', i),
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    };
    let list;

    fetchers.getData(options)
    .then(function(result) {
      console.log(`${options.hostname}/${options.path} success\n`);
      let dom = new JSDOM(result);
      let doc = dom.window.document;

      list = parseDataList(doc);

      list.forEach(function (listItem) {
        let fieldValues = [];

        // Loop through each data point required and attempt to parse the value
        // from provided raw data using provided selector
        mapping.forEach(function(field) {
          let $ = cheerio.load(listItem.outerHTML);
          let result = $(field['selector']);
          if (result.length) {
            let text = result.first().text();
            text = text.trim();
            text = text.replace(/\r?\n|\r/g, "");
            fieldValues.push(text);
          } else {
            fieldValues.push(null);
          }
        })
        appendFileSync(outputFile, fieldValues.join() + "\n");
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

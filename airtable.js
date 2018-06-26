require('dotenv').config();
var Airtable = require('airtable');

var base = new Airtable({
  apiKey: process.env.API_KEY
}).base(process.env.BASE_ID);

const create = (data, cb) => {
  return new Promise((resolve, reject) => {
    base('Imported table')
      .create(data, function (err, record) {
        if (err) {
          reject(err)
        }
        resolve(record.getId());
      });
  })
}

module.exports = create;
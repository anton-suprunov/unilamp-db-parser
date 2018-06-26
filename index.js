const fs = require('fs');
const path = require('path');
const csvPath = path.join(__dirname, 'db.csv');
const parse = require('csv-parse');
const csv = fs.readFileSync(csvPath);

const createRecord = require('./airtable');

/*
  'SKU',
  'Main product',
  'Name',
  'Lu01 group',
  'vis group',
  'diff primary',
  'diff sec',
  'Produktfamilie',
  'Category',
  'Type'
*/

// meaning - DALI?
// stål - is it a color?

const colors = [
  'hvit',
  'grafitt',
  'sølv',
  'sort',
  'matt sort',
  'børstet stål',
  'matt hvit',
  'krom',
  'klar/prism'
]

const colorTriggers = [
  'matt',
  'børstet',
];

const features = [
  'led',
  'em03',
  'sensor',
  'dim',
  'gyro',
  'warmdim',
  'dali',
]

const sockets = [
  'gu10',
  'sgu10',
]

const isType = (type, part) => {
  part = part.toLowerCase();
  if (type === 'color') {
    return colors.indexOf(part) !== -1;
  }
  if (type === 'feature') {
    return features.indexOf(part) !== -1;
  }
  if (type === 'socket') {
    return sockets.indexOf(part) !== -1;
  }
}

//120X360MM
//60mm
// 10 cm
// 10 cm.
//1200/300
const isSize = part => {
  if (/^[\dx]{1,}[ ]{0,1}[cm.]{2,3}$/.test(part)) {
    return true;
  }

  if (/^[\d]{2,}\/[\d]{2,}$/.test(part)) {
    return true;
  }

  return false;
}

//4x4w
//100w
const isPower = part => /^\(*[\dx,-]{1,}w\)*$/i.test(part);

//IP44
//IP 65
const isProtection = part => /^ip[ ]{0,1}\d{2,}$/i.test(part);

//4000k
const isTemperature = part => /^\d{4}k$/i.test(part);

//1000lm
const isBrightness = part => /^\d{3,}lm$/i.test(part);

const isCurrent = part => /^\d{1,}ma$/i.test(part);

const isCRI = part => /^ra\d{2}$/i.test(part);

/*
 "Color": "color",
 "Features": "feature1",
 "Socket": "socket",
 "Size": "size",
 "Power": "power",
 "Protection": "protection",
 "Temperature": "temp",
 "Brightness": "bright",
 "Current": "curr",
 "CRI": "cri"
*/

const testsMap = {
  'Color': isType.bind(null, 'color'),
  'Features': isType.bind(null, 'feature'),
  'Socket': isType.bind(null, 'socket'),
  'Size': isSize,
  'Power': isPower,
  'Protection': isProtection,
  'Temperature': isTemperature,
  'Brightness': isBrightness,
  'Current': isCurrent,
  'CRI': isCRI,
};

/**
 * 
 * @param {Array} parts 
 */
const preProcessParts = parts => {
  let skip = false;

  return parts.reduce((res, curr, i) => {
    let next = parts[i + 1];
    let combined = '';

    if (skip) {
      skip = false;
      return res;
    }

    // combine colors
    if (colorTriggers.indexOf(curr.toLowerCase()) !== -1) {
      combined = curr + ' ' + next;
    } 
    
    // combine IP 65
    if (curr === 'IP' && /^\d{2}$/.test(next)) {
      combined = curr + next;
    }

    //combine sizes
    if (/^\d{1,}$/.test(curr) && /^[cm.]{2,3}$/.test(next)) {
      combined = curr + next;
    }

    if (combined) {
      skip = true;
      res.push(combined);

    } else {
      res.push(curr);
    }

    return res;
  }, []);
}

const testPart = part => {
  for (var k in testsMap) {
    if (testsMap.hasOwnProperty(k)) {
      let res = testsMap[k](part);
      if (res) {
        return k;
      }
    }
  }
}

const processName = name => {
  let parts = preProcessParts(name.split(' '));

  return parts.reduce((prev, part) => {
    let key = testPart(part);
    if (key === 'Features') {
      
      if (part === 'Led') {
        part = 'LED';
      }
      if (part === 'sensor') {
        part = 'Sensor';
      }

      prev['Features'] = prev['Features'] || [];
      prev['Features'].push(part);

    } else if (key) {
      prev[key] = part;
    } else {
      prev['Name stripped'] += ' ' + part;
    }

    return prev;
  }, { 'Name stripped': '' });
}

parse(csv, {
  delimiter: ','
}, function (err, csvOutput) {
  let res = csvOutput.reduce((prev, entry, i) => {
    return prev.then(() => {

      let initials = {
        "SKU": entry[0],
        "Main product": entry[1],
        "Name": entry[2],
        "Produktfamilie": entry[7],
        "Category": entry[8],
        "Type": entry[9],
      };
      
      let parsed = processName(entry[2]);
      if (parsed.Features && parsed.Features.length) {
        parsed.Features = parsed.Features.join(',');
      }

      let row = Object.assign(initials, parsed);
      
      return createRecord(row)
        .then(id => {
          console.log('row created', id);
          return new Promise(resolve => {
            setTimeout(() => {
              resolve();
            }, 100);
          });
        })
        .catch(e => {
          console.log(row);
          console.error(e);
        });
    });

  }, Promise.resolve());
});
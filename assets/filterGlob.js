const minimatch = require("minimatch");

function filterGlob(filenames, glob) {
  return filenames.filter(filename => minimatch(filename, glob))
}

module.exports = filterGlob;
const process = require('process');

module.exports = manifest => {
  return {
    ...manifest,
    id: process.env.PLUGIN_ID || manifest.id,
  }
};
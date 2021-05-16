const process = require('process');

module.exports = {
  manifest: manifest => ({
    ...manifest,
    id: process.env.PLUGIN_ID,
  }),
};
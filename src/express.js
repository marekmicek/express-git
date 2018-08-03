const mock = require("mockery");
mock.registerMock("path-to-regexp", require("path-to-regexp"));
mock.registerMock("events", require("events-as-promised"));
mock.enable({
  warnOnUnregistered: false,
  useCleanCache: true
});
module.exports = require("express");
mock.disable();
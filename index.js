'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var main = function (moduleOptions) {
  var options = _extends({}, this.options.oauth, { moduleOptions: moduleOptions });

  console.log(this.options);
};

module.exports.meta = require('./package.json');

module.exports = main;

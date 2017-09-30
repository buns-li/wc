(function () {
'use strict';

// Must be writable: true, enumerable: false, configurable: true
Object.defineProperty(Object, 'assign', {
  value: function assign(target) {
    // .length of function is 2
    'use strict';

    if (target == null) {
      // TypeError if undefined or null
      throw new TypeError('Cannot convert undefined or null to object');
    }

    var to = Object(target);

    for (var index = 1, l = arguments.length; index < l; index++) {

      var nextSource = arguments[index];

      if (nextSource != null) {
        // Skip over if undefined or null
        for (var nextKey in nextSource) {
          // Avoid bugs when hasOwnProperty is shadowed
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  },
  writable: true,
  configurable: true
});

Array.prototype.includes = function includes(target) {
  for (var l = this.length; l--;) {
    if (this[l] === target) return true;
  }
  return false;
};

var slice = Array.prototype.slice;
var NOP = function NOP() {};

Function.prototype.bind = function bind(scope) {

  var fn = this;

  if (typeof fn !== 'function') {
    // closest thing possible to the ECMAScript 5
    // internal IsCallable function
    throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
  }

  var aArgs = slice.call(arguments, 1),
      fToBind = fn,
      fBound = function fBound() {
    return fToBind.apply(fn instanceof NOP ? fn : scope, aArgs.concat(slice.call(arguments)));
  };

  // Function.prototype doesn't have a prototype property
  if (fn.prototype) NOP.prototype = fn.prototype;

  fBound.prototype = new NOP();

  return fBound;
};

}());

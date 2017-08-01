function isType(type) {
    return function(obj) {
        return Object.prototype.toString.call(obj) === "[object " + type + "]"
    }
}

const
    isObject = isType("Object"),
    isString = isType("String"),
    isArray = Array.isArray || isType("Array"),
    isFunction = isType("Function")

, extend = Object.assign

, print = msg => console.warn(msg)

, isInVisualArea = () => true

if (![].includes) {
    Array.prototype.includes = function(item) {
        for (let l = this.length; l--;) {
            if (this[l] === item) return true
        }
        return false
    }
}

let slice = Array.prototype.slice,
    fNOP = function() {}

Function.prototype.bind = Function.prototype.bind || function(oThis) {
    if (typeof this !== 'function') {
        // closest thing possible to the ECMAScript 5
        // internal IsCallable function
        throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

    let aArgs = slice.call(arguments, 1),
        fToBind = this,
        fBound = function() {
            return fToBind.apply(this instanceof fNOP ? this : oThis,
                aArgs.concat(slice.call(arguments)))
        }

    // Function.prototype doesn't have a prototype property
    if (this.prototype) fNOP.prototype = this.prototype

    fBound.prototype = new fNOP()
    return fBound
}

export {
    extend,
    isObject,
    isString,
    isArray,
    isFunction,
    print,
    isInVisualArea,
    ERRFLAG
}
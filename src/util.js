export function isType(type) {
    return function(obj) {
        return Object.prototype.toString.call(obj) === '[object ' + type + ']'
    }
}

export const isArray = Array.isArray || isType('Array')

export const isFunction = isType('Function')
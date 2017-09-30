export function isType(type) {
  return obj => Object.prototype.toString.call(obj) === '[object ' + type + ']'
}

export const isArray = Array.isArray || isType('Array')

export const isFunction = isType('Function')

export const isObject = isType('Object')
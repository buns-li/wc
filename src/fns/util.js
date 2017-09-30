/**
 * 函数节流
 * @param  {Function} func    被节流包装的实际调用函数
 * @param  {Number} wait    函数节流的执行时间间隔
 * @param  {Object} options 可选参数
 * @return {[type]}         [description]
 */
export function throttle(func, wait, options) {

  let context,
    args,
    result,
    timeout = null,
    previous = 0

  if (!options)
    options = {}

  let later = function() {
    previous = options.leading === false ? 0 : new Date().getTime()
    timeout = null
    result = func.apply(context, args)
    if (!timeout)
      context = args = null
  }

  return function() {
    let now = new Date().getTime()
    if (!previous && options.leading === false)
      previous = now
    let remaining = wait - (now - previous)
    context = this
    args = arguments
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      result = func.apply(context, args)
      if (!timeout)
        context = args = null
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining)
    }
    return result
  }
}
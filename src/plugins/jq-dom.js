/**
 * 判断当前元素是否在当前可视区域内
 *
 * @param {any} selector 元素选择器(只取一个)
 * @param {any} threshold 偏移阈值
 * @returns
 */
function isInVisualArea(selector, threshold) {

    threshold = threshold || 0

    let
        target = $(selector),
        offset = target.offset(),
        tg_left_begin = offset.left - threshold,
        tg_top_begin = offset.top - threshold,
        tg_left_end = target.width() + tg_left_begin + threshold,
        tg_top_end = target.height() + tg_top_begin + threshold

    let $win = $w || $(window),
        win_left_begin = $win.scrollLeft(),
        win_top_begin = $win.scrollTop(),
        win_left_end = win_left_begin + $win.width(),
        win_top_end = win_top_begin + $win.height()

    return !(
        tg_left_begin > win_left_end ||
        win_left_begin > tg_left_end ||
        tg_top_begin > win_top_end ||
        win_top_begin > tg_top_end
    )
}

/**
 * 函数节流
 * @param  {Function} func    被节流包装的实际调用函数
 * @param  {Number} wait    函数节流的执行时间间隔
 * @param  {Object} options 可选参数
 * @return {[type]}         [description]
 */
function throttle(func, wait, options) {

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

wc.web('$', function(selector) {
    let ctx = this.ctx
    if (!ctx) return window.$(selector)

    if (!selector) return window.$(this.ctx)
    return window.$(this.ctx + ' ' + selector)
})

let $doc = $(document).ready(() => wc.load('ready', null, isInVisualArea))

let $w = $(window).on('load', () => wc.load('loaded', null, isInVisualArea))
    .on('resize', throttle(() => wc.load('resize', [$w.width(), $w.height(), $doc.width(), $doc.height()], isInVisualArea), 300))
    .on('scroll', throttle(() => wc.load('scroll', [$w.scrollTop(), $w.scrollLeft()], isInVisualArea), 300))
export const jQ = window.$ || window.jQuery

/**
 * DOM元素筛选操作---基于jQuery
 * 
 * @export
 * @param {String} selector - 筛选器(类似jquery的selector) 
 * @returns jQuery对象
 */
export function $(selector) {

  let ctx = (this.ctx || ('#' + this.id))

  if (!ctx) return jQ(selector)

  if (!selector) return jQ(ctx)

  if (selector.nodeType) return jQ(selector)

  return jQ(ctx + ' ' + selector)
}

/**
 * 判断当前元素是否在当前可视区域内
 *
 * @param {any} selector 元素选择器(只取一个)
 * @param {any} threshold 偏移阈值
 * @returns
 */
export function isInVisualArea(selector, threshold) {

  threshold = threshold || 0

  let target = $(selector)

  if (!target) return false

  let
    offset = target.offset(),
    tg_left_begin = offset.left - threshold,
    tg_top_begin = offset.top - threshold,
    tg_left_end = target.width() + tg_left_begin + threshold,
    tg_top_end = target.height() + tg_top_begin + threshold

  let $win = $(window),
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
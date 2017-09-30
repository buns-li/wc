import { isArray } from './util'

/**
 * 存储所有事件的对象
 * @type {Object}
 */
export let events = {}

/**
 * a publish / subscribe event bus
 */
const ebus = {

  /**
   * 注册事件至事件总线中
   *
   *  事件的注册是覆盖形式的,如果出现重名事件不同顺序注册的情况
   *
   * @param {String} evtName 事件名称
   * @param {Function} handler 事件处理函数
   * @param {Boolean} [isOnce=false] 是否是作为只消费一次的事件
   */
  on: function(evtName, handler, isOnce) {

    if (!evtName || !handler) return this

    let cb = handler

    if (isOnce) {

      let fire = false,
        _cb = handler

      cb = function() {
        ebus.off(evtName, cb)
        if (!fire) {
          fire = true
          _cb.apply(this, arguments)
        }
      }
    }

    for (let list, l = (evtName = evtName.split(',')).length; l--;) {
      list = events[evtName[l]] || (events[evtName[l]] = [])
      list.push(cb)
    }

    return this
  },

  /**
   * 移除在事件总线中已注册的事件
   *
   *  移除方式:
   *      1. 只提供事件名称
   *      2. 即提供事件名称以及事件处理函数
   *      3. 删除所有
   *
   * @param {String} evtName 事件名称
   * @param {Function} handler  事件处理函数
   * @memberof ebus
   * @returns {Object} ebus
   */
  off(evtName, handler) {

    // Remove all events
    if (!(evtName || handler)) {
      events = {}
      return this
    }

    let list = events[evtName],
      l

    if (list && (l = list.length)) {
      if (!handler) {
        // Remove all events
        delete events[evtName]
      } else {
        for (; l--;) {
          if (list[l] === handler)
            list.splice(l, 1)
        }
      }
    }

    return this
  },

  /**
   * 发出事件
   *
   * @param {String|Array} evtName 事件名称
   * @param {any} data 发出数据
   * @param {Function} tracerRecorder 事件发布订阅过程的站点记录函数
   */
  emit(evtName, data, tracerRecorder) {

    if (!evtName) return

    if (!isArray(data)) data = [data]

    let list, l2

    if (!isArray(evtName)) {

      list = events[evtName]

      if (!list || !(l2 = list.length)) return

      tracerRecorder && tracerRecorder.sub(evtName, l2)

      list = list.slice()

      for (; l2--;) {

        tracerRecorder && tracerRecorder.hndIdx(l2)

        list[l2].apply(null, data)
      }

      return
    }
    for (let i = 0, l = evtName.length; i < l; i++) {

      list = events[evtName[i]]

      if (!list || !(l2 = list.length)) continue

      tracerRecorder && tracerRecorder.sub(evtName[i], l2)

      list = list.slice()

      for (; l2--;) {

        tracerRecorder && tracerRecorder.hndIdx(l2)

        list[l2].apply(null, data)
      }
    }
  }
}

export default ebus
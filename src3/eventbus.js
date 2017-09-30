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
     * @param {any} eventName 事件名称
     * @param {any} handler 事件处理函数
     * @param {any} isOnce 是否是作为只消费一次的事件
     */
    on: function(eventName, handler, isOnce) {

        if (!eventName || !handler) return this

        let cb = handler

        if (isOnce) {

            let fire = false,
                _cb = handler

            cb = function() {
                ebus.off(eventName, cb)
                if (!fire) {
                    fire = true
                    _cb.apply(this, arguments)
                }
            }
        }

        for (let list, l = (eventName = eventName.split(',')).length; l--;) {
            list = events[eventName[l]] || (events[eventName[l]] = [])
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
     * @param {String} eventName 事件名称
     * @param {Function} handler  事件处理函数
     * @memberof ebus
     * @returns {Object} ebus
     */
    off(eventName, handler) {

        // Remove all events
        if (!(eventName || handler)) {
            events = {}
            return this
        }

        let list = events[eventName],
            l

        if (list && (l = list.length)) {
            if (!handler) {
                // Remove all events
                delete events[eventName]
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
     * @param {String|Array} eventName 事件名称
     * @param {any} data 发出数据
     * @param {Function} tracerRecorder 事件发布订阅过程的站点记录函数
     */
    emit(eventName, data, tracerRecorder) {

        if (!eventName) return

        if (!isArray(data)) data = [data]

        let list, l2

        if (!isArray(eventName)) {

            list = events[eventName]

            if (!list || !(l2 = list.length)) return

            tracerRecorder && tracerRecorder.sub(eventName, l2)

            list = list.slice()

            for (; l2--;) {

                tracerRecorder && tracerRecorder.hndIdx(l2)

                list[l2].apply(null, data)
            }

            return
        }
        for (let i = 0, l = eventName.length; i < l; i++) {

            list = events[eventName[i]]

            if (!list || !(l2 = list.length)) continue

            tracerRecorder && tracerRecorder.sub(eventName[i], l2)

            list = list.slice()

            for (; l2--;) {

                tracerRecorder && tracerRecorder.hndIdx(l2)

                list[l2].apply(null, data)
            }
        }
    }
}

export default ebus
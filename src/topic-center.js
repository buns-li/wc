import { ERRFLAG, topics, cur_topic_tracing } from './variable'

/**
 * 操纵主题的控制中心
 *
 *  1. 订阅主题
 *  2. 取消订阅主题
 *  3. 单向发布主题
 *  4. 发布主题并接受订阅者反馈
 */
export default function TopicCenter() {}

/**
 * 注册主题到处理中心
 * @return {[type]} [description]
 */
TopicCenter.on = function(name, fn, isOnce) {
    let self = this

    if (!name || !fn)
        return self

    let cb = fn

    if (isOnce) {

        let fire = false,
            _cb = fn

        cb = function() {
            TopicCenter.off(name, cb)
            if (!fire) {
                fire = true
                _cb.apply(this, arguments)
            }
        }
    }

    for (let list, l = (name = name.split(',')).length; l--;) {
        list = topics[name[l]]
        if (list && list.length) {
            list.push(cb)
        } else {
            topics[name[l]] = [cb]
        }
    }

    return this
}

/**
 * 卸载主题
 * @param  {[type]}   name [description]
 * @param  {Function} fn        [description]
 * @return {[type]}             [description]
 */
TopicCenter.off = function(name, fn) {
    let self = this

    // Remove *all* events
    if (!(name || fn)) return self

    let list = topics[name],
        l

    if (list && (l = list.length)) {
        if (fn) {
            for (; l--;) {
                if (list[l] === fn)
                    list.splice(l, 1)
            }
        } else {
            delete topics[name]
        }
    }

    return self
}

TopicCenter.emit = function(topicNames, data) {

    let list, l2, l = topicNames.length

    for (let i = 0; i < l; i++) {

        cur_topic_tracing.sub_topic_idx = i

        list = topics[topicNames[i]]

        if (!list || !list.length) continue

        list = list.slice()

        for (l2 = list.length; l2--;) {

            cur_topic_tracing.sub__topic_fn_idx = l2

            list[l2].apply(null, data)
        }
    }
}
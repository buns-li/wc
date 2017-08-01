import TopicCenter from './topic-center'

import {
    allowBrowserTopics,
    STATE,
    ERRFLAG,
    cmps,
    topics,
    waiting_call,
    cur_topic_tracing
} from './variable'

import { isString } from './util'

const SIGNALSEPRATOR = '::'

const TOPICSEPRATOR = '_'

/**
 * 组件定义库
 */
export default function CMP(id, opts, factory) {
    this.id = id
    this.opts = opts
    this.fac = factory
    this.state = STATE.unfetch
}

CMP.nameFn = function(cmpid, topic) {
    return cmpid + TOPICSEPRATOR + topic
}

/**
 * 装载组件
 * @param  {Object} cmpIns [description]
 */
CMP.load = function(cmpIns) {

    let factory = cmpIns.fac

    factory.call(cmpIns)

    cmpIns.state = STATE.loaded

    delete cmpIns.fac

    //查看waiting_topics中是否存在当前组件的等待被呼叫的主题

    let item = waiting_call[cmpIns.id]
    if (!item) return

    let deps = cmps[item.pub].deps
    if (!deps) return

    let subscriber_kv_arr = deps[item.pub]

    if (!subscriber_kv_arr || !subscriber_kv_arr.length || !subscriber_kv_arr.__cb) return undefined

    cur_topic_tracing.pub = item.pub
    cur_topic_tracing.time = item.time

    let real_topics = subscriber_kv_arr[cur_topic_tracing.sub_idx = idx]

    TopicCenter.emit(CMP.nameFn(cmpIns.id, real_topics.join(',' + cmpIns.id + TOPICSEPRATOR)).split(','), item.data)
}

CMP.util = {
    pause: function() {

        if (!cur_topic_tracing.cmp || !cur_topic_tracing.pub) return undefined

        let deps = cmps[cur_topic_tracing.cmp].deps

        let subscriber_kv_arr = deps[cur_topic_tracing.pub]

        if (!subscriber_kv_arr || !subscriber_kv_arr.length || !subscriber_kv_arr.__cb) return undefined

        let sub_idx = cur_topic_tracing.sub_idx

        let trace = subscriber_kv_arr[sub_idx].__trace = subscriber_kv_arr[sub_idx].__trace || {}

        let time = cur_topic_tracing.time

        trace[time] = trace[time] || []

        return cur_topic_tracing.cmp + SIGNALSEPRATOR + cur_topic_tracing.pub + SIGNALSEPRATOR + cur_topic_tracing.sub_idx + SIGNALSEPRATOR + time + SIGNALSEPRATOR + cur_topic_tracing.sub_topic_idx + SIGNALSEPRATOR + cur_topic_tracing.sub_topic_fn_idx
    },
    /**
     * 恢复当前的主题发布过程
     * @type {Object}
     */
    resume: function(data, signal) {

        if (!signal) {
            throw new Error(ERRFLAG.E103)
        }

        //通过这个恢复信号来得到当前的发布订阅消息,publisher = who , subscriber_idx, 格式: publisher__times__subscriberidx__subscriberfnidx
        let arr = signal.split(SIGNALSEPRATOR)

        let cmp = cmps[arr[0]]
        if (!cmp) return

        let deps = cmp.deps
        if (!cmp) return

        let subscriber_kv_arr = deps[arr[1]]

        if (!subscriber_kv_arr || !subscriber_kv_arr.length || !subscriber_kv_arr.__cb) return

        let cbdatas = subscriber_kv_arr[arr[2]].__trace[arr[3]]

        let sub_fn_cbs = cbdatas[arr[4]] = cbdatas[arr[4]] || []

        sub_fn_cbs[arr[5]] = data

        //判断是否已经执行完成
        //获取主题依赖中的具体topics
        let real_topics = deps[arr[1]][arr[2]].topics

        let real_topic_fns = topics[CMP.nameFn(arr[0], real_topic[arr[4]])]

        if (sub_fn_cbs.length === real_topic_fns) {
            sub_fn_cbs.__fnok = true
        }

        if (cbdatas.length === real_topics.length) {
            let fnok = true
            for (let l = cbdatas.length; l--;) {
                if (!('__fnok' in cbdatas[l]) && cbdatas[l].__fnok) {
                    fnok = false
                    break
                }
            }
            if (fnok) {
                let cb = subscriber_kv_arr.__cb

                cb.apply(null, cbdatas)

                delete subscriber_kv_arr[arr[2]].__trace[arr[3]]
            }
        }
    }
}


CMP.prototype = {

    constructor: CMP,
    /**
     * 对外定义输出可被允许触发的关联
     * @param  {String}   name 主题名称
     * @param  {Function} fn   主题响应
     * @return {[type]}        [description]
     */
    out: function(name, fn) {
        TopicCenter.on(CMP.nameFn(this.id, name), fn.bind(CMP.util))
        return this
    },
    /**
     * 订阅浏览器宿主主题
     */
    host: function(name, fn) {
        if (allowBrowserTopics.includes(name)) {
            TopicCenter.on(name, fn.bind(CMP.util), name === 'ready' || name === 'loaded')
        }
        return this
    },
    /**
     * 发布当前组件的主题
     *  
     *    获取当前组件的关联主题,从而获得关联的依赖组件,判断该组件的状态,是否已经loaded,
     *    如果是fetched，则执行CMP.load加载
     *    如果是fetching,将其需要被呼叫的响应主题的调用存储至waiting_topics中
     *    如果是unfetch,一样的将其放入waiting_topics中
     *
     *   pub(name,data,cb)
     *        name:当前组件内部的主题名称
     *        data:发布出去的数据
     *        cb: [optional] 用于接收订阅方返回结果的数据处理
     *         记录当前主题的关联主题数目,已经返回结果的先放置在缓冲区,可以等待
     *
     * @type {Object}
     */
    pub: function(name, data, cb) {

        //获取当前待发布主题的订阅方
        let deps = this.deps

        if (!name || !deps) return this

        let subscriber_kv_arr = deps[name]

        subscriber_kv_arr.__cb = cb

        if (!subscriber_kv_arr || !subscriber_kv_arr.length) return this

        cur_topic_tracing.pub = name
        cur_topic_tracing.cmp = this.id

        let cmp, cmpItem, cmpid,
            subscriber_topics = [],
            tmp, l2
        for (let i = 0, l = subscriber_kv_arr.length; i < l; i++) {

            cmpItem = subscriber_kv_arr[i]

            cmp = cmps[cmpid = cmpItem.id]

            if (!!~cmpItem.topics.indexOf(',')) {
                cmpItem.topics = cmpItem.topics.split(',')
            } else if (isString(cmpItem.topics)) {
                cmpItem.topics = [cmpItem.topics]
            }

            cur_topic_tracing.sub_idx = i

            cur_topic_tracing.time = new Date().getTime()

            switch (cmp.state) {
                case STATE.fetched:
                    CMP.load(cmp)
                case STATE.loaded:
                    TopicCenter.emit(CMP.nameFn(cmpid, cmpItem.topics.join(',' + cmpid + TOPICSEPRATOR)).split(','), data)
                    break
                case STATE.fetching:
                case STATE.unfetch:
                    //装载进入waiting_call
                    tmp = waiting_call[cmpItem.id] = waiting_call[cmpItem.id] || {}
                    tmp.idx = i
                    tmp.pub = this.id
                    tmp.time = cur_topic_tracing.time
                    tmp.data = data
                    break
            }
        }

        return this
    }
}
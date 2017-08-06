import { browserActions, waitingSubscribers, cmps, conf } from './variable'

import ebus from './eventbus'

import EventTracer from './eventbus-tracer'

const EVENT_SPERATOR = '_'


/**
 * 组件的定义
 *
 * 1. 最基础的组件定义
 *      * `id`
 *      * `options`
 *      * `factory`
 *      * `state`: 组件的状态  0 未请求 1.请求中 2.已请求 3.已装载
 *
 * 组件的交互
 *
 *   1.利用`out`定义对外可被调用的事件
 *   2.通过依赖绑定形成组件间接关联
 *   3.通过`pub`发布事件,利用eventbus来形成桥梁连接其他事件
 *   4.事件的交互过程成会存在着异步不按顺序的执行,此时借鉴nodejs流的暂停模式, 增加pause()和resume()操作
 *
 *
 *  组件的装载
 *  > 明确宿主环境是浏览器环境
 *
 *  1. 主动加载: script直接页面引入形式
 *  2. 被动加载: 只到该出现的时候再装载，延迟加载、懒加载
 *
 */
export default function Component(id, options, factory) {

    this.id = id

    this.opt = options || {}

    this.fac = factory

    this.state = 0 //unfetched
}

/**
 * 组件完整事件名称命名方法
 */
Component.nameFn = function(cmpid, eventName) {
    return cmpid + EVENT_SPERATOR + eventName
}

Component.prototype = {

    constructor: Component,

    /**
     * 发布事件
     *
     * @param {String} eventName 待发布的事件名称
     * @param {Object|Array} 当前发布事件携带的数据
     * @param {Function} 用于接收订阅方反馈数据的回调 *Optional*
     */
    pub: function(eventName, data, cb) {

        let fullEventName = Component.nameFn(this.id, eventName)

        //寻找此主题的订阅方
        let tracer = EventTracer.get(fullEventName) //已经知道当前的发出方信息

        if (!tracer) return this

        let
            subscribersKV = tracer.subs

        , subCMPID

        , subEvtArr

        , subEvtArrLen

        , subCMP

        , waitingSubEvtMapKV

        , waitingSubEvtMapItemArr

        , totalSubLen = 0

        if (!subscribersKV) return this

        //追踪过程的当前站点信息记录
        let tracerRecorder = tracer.record(fullEventName, this.id)

        let waitingFetchCMPs = []

        for (subCMPID in subscribersKV) {

            subEvtArr = subscribersKV[subCMPID]

            if (!subEvtArr) continue
            if (!subEvtArr.length) {
                delete subscribersKV[subCMPID]
                continue
            }

            subCMP = cmps[subCMPID]

            if (!subCMP) continue

            subEvtArrLen = subEvtArr.length

            totalSubLen += subEvtArrLen

            //如果事件订阅方组件的状态是unfetch(0)或者fetcing(1)的情况下,要将事件推送到等待缓冲中
            if (subCMP.state === 0 || subCMP.state === 1) {
                if (subCMP.state === 0) {
                    waitingFetchCMPs.push(subCMPID)
                }

                waitingSubEvtMapKV = waitingSubscribers[subCMPID]

                if (!waitingSubEvtMapKV) continue

                for (; subEvtArrLen--;) {
                    waitingSubEvtMapItemArr = waitingSubEvtMapKV[subEvtArr[subEvtArrLen]]

                    if (!waitingSubEvtMapItemArr) {
                        waitingSubEvtMapKV[subEvtArr[subEvtArrLen]] = [{
                            cmp: this.id,
                            evt: eventName,
                            data: data
                        }]
                    } else if (!waitingSubEvtMapItemArr.length) {
                        waitingSubEvtMapItemArr.push({
                            cmp: this.id,
                            evt: eventName,
                            data: data
                        })
                    } else {
                        let isRepeat = false

                        //判断是否出现重复
                        for (let waitingSubEvtMapItemArrLen = waitingSubEvtMapItemArr.length; waitingSubEvtMapItemArrLen--;) {

                            let mapItem = waitingSubEvtMapItemArr[waitingSubEvtMapItemArrLen]

                            if (mapItem.cmp === this.id && mapItem.evt === eventName) {
                                mapItem.data = data
                                isRepeat = true
                            }
                        }

                        if (!isRepeat) {
                            waitingSubEvtMapItemArr.push({
                                cmp: this.id,
                                evt: eventName,
                                data: data
                            })
                        }
                    }
                }

                if (waitingFetchCMPs && waitingFetchCMPs.length && this.http) {
                    let url, len = waitingFetchCMPs.length
                    if (conf.combo) {
                        if (conf.combo.js) {
                            url = conf.combo.js(waitingFetchCMPs, conf.root)
                            for (; len--;) cmps[waitingFetchCMPs[len]].state = 1
                            Component.prototype.http(url)
                                .then(() => { for (len = waitingFetchCMPs.length; len--;) Component.load(cmps[waitingFetchCMPs[len]]) })
                                .catch(() => { for (len = waitingFetchCMPs.length; len--;) cmps[waitingFetchCMPs[len]].state = 1 })
                        }
                        if (conf.combo.css) {
                            url = conf.combo.css(waitingFetchCMPs, conf.root)
                            Component.prototype.http(url)
                        }
                        if (conf.combo.tpl) {
                            url = conf.combo.tpl(waitingFetchCMPs, conf.root)
                            Component.prototype.http(url)
                        }
                    } else {
                        for (let cmp; len--;) {
                            url = conf.root + waitingFetchCMPs[len] + '.js'
                            cmp = cmps[waitingFetchCMPs[len]]
                            cmp.state = 1
                            cmp.http(url).then(() => Component.load(cmp)).catch(() => { cmp.state = 0 })
                        }
                    }
                }

                continue
            }

            for (; subEvtArrLen--;) {
                ebus.emit(Component.nameFn(subCMPID, subEvtArr[subEvtArrLen]), data, tracerRecorder)
            }
        }

        tracer.sublen = totalSubLen
        tracer.cb = cb
    },

    /**
     * 定义一个对外事件
     *  用于作为订阅方
     *
     * @param {String} 事件名称
     * @param {Function} 事件处理函数
     */
    out: function(eventName, handler) {
        ebus.on(Component.nameFn(this.id, eventName), handler.bind(Component.eventRicher))
        return this
    },

    /**
     * 适配浏览器的生命周期和操作
     */
    env: function(eventName, handler) {

        if (browserActions.includes(eventName)) {

            let fullEvtName = Component.nameFn(this.id, eventName)

            ebus.on(fullEvtName, handler.bind(Component.eventRicher), eventName === 'ready' || eventName === 'loaded')

            //注册组件__env__与此组件的关联关系

            let tracer = EventTracer.get(Component.nameFn('__env__', eventName))
            if (!tracer) {
                EventTracer.set(tracer = new EventTracer(eventName, '__env__'))
            }

            tracer.addSub(this.id, eventName)
        }

        return this
    }
}

/**
 * 丰富组件事件发布订阅处理
 */
Component.eventRicher = {
    /**
     * 暂停当前事件发布订阅传输的路线
     *
     * @return 返回当前事件发布订阅的运行信号串
     */
    pause: function() {
        return EventTracer.signal()
    },

    /**
     * 恢复当前信号串所对应的发布订阅过程
     */
    resume: function(signal, data) {
        EventTracer.signal(signal, data)
    }
}

/**
 * 装载组件
 */
Component.load = function(cmp) {

    let factory = cmp.fac

    factory.call(cmp)

    cmp.state = 3

    /*
     * ==================================================
     *  开始根据订阅方事件缓冲去判断当前组件作为事件的订阅方是否存在未及时执行的事件
     *
     *   订阅方发生未及时执行的事件的情形如下:
     *
     *     前提一: 发布方已经装载完毕,并且在浏览器的生命周期DOMContentLoaded的时候开始主动发布事件
     *
     *     此时的订阅方有如下几种状态:
     *          1. 未获取
     *          2. 正在远程获取中
     *          3. 已经装载
     *
     *     针对状态1和状态2的组件,则会产生等待事件
     *
     *     前提二: 框架开启了延迟装载功能
     *
     *       该功能会根据当前浏览器可视区域范围内,判断那些组件是否坐落在此区域,如果不在则不装载组件;
     *       只有当发生scroll、resize等可以让组件呈现在可视区域的前提下,才会装载
     *
     *       故此,如果订阅方组件不在可视范围内(在发布方发布事件的时候),则会将此订阅方以及订阅方的关联事件存储至订阅方事件缓冲中
     *
     * ==================================================
     */
    let subscribers = waitingSubscribers[cmp.id]

    let
        pubArr,
        pubArrLen,
        pub,
        tracer,
        publisherEvt

    for (let sub in subscribers) {

        pubArr = subscribers[sub]

        if (!pubArr || !pubArr.length) {
            delete subscribers[sub]
            continue
        }

        for (pubArrLen = pubArr.length; pubArrLen--;) {

            pub = pubArr[pubArrLen]

            tracer = EventTracer.get(publisherEvt = Component.nameFn(pub.cmp, pub.evt))

            if (!tracer) {
                //删除数组元素
                pubArr.splice(pubArrLen, 1)
                continue
            }

            let tracerRecorder = tracer.record(publisherEvt, pub.cmp)

            ebus.emit(Component.nameFn(cmp.id, sub), pub.data, tracerRecorder)
        }

    }
}

//初始化系统环境组件
cmps.__env__ = new Component('__env__', null, function() {})
cmps.__env__.state = 2
import Component from './cmp'

/**
 * 事件发布订阅过程的追踪对象缓存列表
 */
const tracerCaches = {}

/**
 * 当前追踪游标
 */
const cursor = {}

/**
 * 信号串分隔符
 * {String}
 */
const SIGNALSEPRATOR = '::'

/**
 * 事件发布订阅关系
 *  
 *   this.times:
 *      {
 *         time:{
 *          subscriber:{
 *              len:0
 *              datas:[]
 *          }
 *         }
 *      }
 * 
 *  this.subs:
 *      {
 *          "cmpid": ["事件名称"]
 *      }
 * 
 * @param {any} publisherFullEvtName 发布方事件
 * @param {any} cmp 发布方所属组件
 */
export default function EventTracer(publisherFullEvtName, cmp) {
    this.cmp = cmp
    this.evt = publisherFullEvtName
    this.subs = {}
    this.times = {}
    this.cb = null
    this.sublen = 0
}

EventTracer.prototype = {

    constructor: EventTracer,

    /**
     * 新增当前发布订阅事件追踪的订阅方
     *
     * @param {String} cmpid 订阅方组件id
     * @param {String} eventName 订阅方的事件名称
     */
    addSub: function(cmpid, eventName) {
        let evts = this.subs[cmpid]
        if (!evts) {
            this.subs[cmpid] = [eventName]
        } else {
            evts.push(eventName)
        }
    },

    /**
     * 记录当前的事件发布订阅过程所流转到的订阅方以及订阅方的处理器索引
     *
     * @param {any} curPublisher 当前订阅方事件名称
     * @param {any} curCmp 当前订阅方组件id
     */
    record: function(publisherCMPID, publisherFullEventName) {
        cursor.c = publisherCMPID
        cursor.p = publisherFullEventName
        cursor.t = new Date().getTime()

        let times = this.times[cursor.t] = { __oklen: 0 }

        return {
            sub: function(subscriberFullEventName, subscriberHandlersLength) {
                cursor.s = subscriberFullEventName
                if (!times[subscriberFullEventName]) {
                    times[subscriberFullEventName] = {
                        len: subscriberHandlersLength || 0,
                        datas: []
                    }
                }
            },
            hndIdx: function(hndIdx) {
                cursor.hndIdx = hndIdx
            }
        }
    }
}

/**
 * 生成/解析事件信号串
 */
EventTracer.signal = function(value, data) {

    if (!value) {
        //生成信号串
        return cursor.c + SIGNALSEPRATOR + cursor.p + SIGNALSEPRATOR + cursor.t + SIGNALSEPRATOR + cursor.s + SIGNALSEPRATOR + cursor.hndIdx
    } else {
        //解析信号串

        let arr = value.split(SIGNALSEPRATOR)

        let tracer = tracerCaches[arr[1]]

        if (!tracer) return

        let timeItem = tracer.times[arr[2]]

        if (!timeItem) return

        let subsItem = timeItem[arr[3]]

        if (!subsItem) return

        subsItem.datas[arr[4]] = data

        if (subsItem.len === subsItem.datas.length) {
            timeItem.__oklen += 1
        }

        if (timeItem.__oklen === tracer.sublen) {
            //此次发布订阅过程已经结束
            if (tracer.cb) {

                //获取所有数据
                let arr = []

                delete timeItem.__oklen

                for (let subscriber in timeItem) {
                    delete timeItem[subscriber].len
                    arr.push(timeItem[subscriber])
                }

                tracer.cb.apply(null, arr)
            }
            //删除这个发布订阅过程
            tracer.times[arr[2]] = null
        }
    }
}

/**
 * 获取事件追踪对象
 *
 * @param {String} publisherFullEventName 事件发布方名称
 * @return {EventTracer|Null} 事件追踪对象
 */
EventTracer.get = function(publisherFullEventName) {
    return publisherFullEventName ? tracerCaches[publisherFullEventName] : null
}

/**
 * 存储事件追踪对象
 */
EventTracer.set = function(tracer) {
    if (tracer) {
        tracerCaches[Component.nameFn(tracer.cmp, tracer.evt)] = tracer
    }
}
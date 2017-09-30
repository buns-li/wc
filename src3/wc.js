import { conf, cmps, remainCmps, waitingSubscribers, browserActions, allowWeblize } from './variable'

import { events } from './eventbus'

import Component from './cmp'

import { isArray, isFunction } from './util'

import EventTracer from './eventbus-tracer'

/**
wc('id')
    .opts({})
    .at('ctx')
    .sub('cmp1',['text1','text2'],'out1')
    .sub('cmp1',['text4','text3'],'out2')
    .sub('cmp2',['text4','text3'],'out2')
    .sub('cmp2',['text4','text3'],'out2')
 */
let wc = window.wc = function wc(id) {
    return new wcExt.ctor(id)
}

// The current version of wc being used
wc.version = '0.0.1'

/**
 * wc配置
 * 
 *  options配置项清单如下:
 *     `combo`: [Boolean] 是否启用在线combo (Default:false)
 *     `thresold`:[`Number`] 距离底部
 *     `tpl` [`Boolean`] 是否启用模板操作 (Default:false)
 *     `anim`:[`Boolean`] 是否启用动画操作 (Default:false)
 *     `$`:[`Boolean`] 是否启用动画操作 (Default:false)
 *     `http`:[`Boolean`] 是否启用动画操作 (Default:false)
 *     `cache`:[`Boolean`] 是否启用动画操作 (Default:false)
 *
 * @param {Object} configMeta 客户端配置
 */
wc.config = function(configMeta) {

    if (configMeta.debug) {
        wc.data = {
            cmps: cmps,
            waitingSubscribers: waitingSubscribers,
            events: events
        }
    }
    conf.threshold = configMeta.threshold || 0
    conf.root = configMeta.root
    conf.combo = configMeta.combo
}

/**
 * 组件定义
 *
 * @param {String} id 组件id
 * @param {Object} options 组将对外配置项
 * @param {Function} factory 组件工厂
 *
 */
wc.define = function(id, options, factory) {

    if (!id) return

    let cmp = cmps[id]

    if (!cmp) {

        cmp = cmps[id] = new Component(id, options, factory)

    } else {

        //合并opts和更新factory
        cmp.fac = factory

        options && (cmp.opts = cmp.opts ? Object.assign(cmp.opts, options) : options)

    }

    cmp.state = 2
}

/**
 * 加载组件基于宿主环境的情况下
 * 
 * @param {String} action 浏览器操作名称
 * @param {any} data 传输数据
 * @param {Function} isInVisiableFn 是否在可视区域内的方法
 */
wc.load = function(action, data, isInVisiableFn) {

    if (!action) return

    if (!browserActions.includes(action)) return

    let cmp, loadedcmp, waitingFetchCMPs = []

    if (remainCmps && remainCmps.length) {

        for (let l = remainCmps.length; l--;) {

            cmp = cmps[remainCmps[l]]

            if (cmp.state === 2) {
                Component.load(cmp)
                remainCmps.splice(l, 1)
                loadedcmp = true
                continue
            } else if (cmp.state === 0 && cmp.ctx && cmp.http && isInVisiableFn && isInVisiableFn(cmp.ctx)) {
                waitingFetchCMPs.push(cmp.id)
            }
            loadedcmp = false
        }

    } else {
        for (let cmpid in cmps) {
            if ('__env__' === cmpid) continue
            cmp = cmps[cmpid]
            switch (cmp.state) {
                case 0: //unftech
                    if (cmp.state === 0 && cmp.ctx && cmp.http && isInVisiableFn && isInVisiableFn(cmp.ctx)) waitingFetchCMPs.push(cmp.id)
                case 1: //fetching
                    remainCmps.push(cmp.id)
                    loadedcmp = false
                    break
                case 2: //fetched
                    Component.load(cmp)
                case 3:
                default:
                    //loaded
                    loadedcmp = true
                    break
            }
        }
    }

    if (waitingFetchCMPs && waitingFetchCMPs.length && Component.prototype.http) {
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
            for (; len--;) {
                url = conf.root + waitingFetchCMPs[len] + '.js'
                cmp = cmps[waitingFetchCMPs[len]]
                cmp.state = 1
                cmp.http(url).then(() => Component.load(cmp)).catch(() => { cmp.state = 0 })
            }
        }
    }
    loadedcmp && cmps.__env__.pub(action, data) //系统组件主动发布事件
}

/**
 * 组件的web化
 *  1. 给组件增加适应web端的操作:
 *
 *          dom:可以操作dom元素
 *          http: 可以做服务器资源访问
 *          anim: 动画增强客户端效果
 *          cache: web端缓存操作
 *          tpl: web端模板操作
 *  2.由于组件具备web化之后,便会形成不同类别的组件
 *      1) 偏元素呈现效果的
 *      2) 偏服务器端操作的
 *      3) 偏效果增强的
 *      等等
 * 
 *  组件的web宿主适应性
 *  > 由于组件是寄生在浏览器这个宿主环境中的,所以必须要和当前宿主形成一个良好的匹配性
 *
 *  1.浏览器变化的时候能够有规则的随之变化
 *  2.组件的装载必须严格按照浏览器宿主的生命周期出现,所有组件的装载是必须依托于当前组件所在浏览器页面的生命周期
 */
wc.web = function(usage, handler) {
    if (allowWeblize.includes(usage) && isFunction(handler)) {
        Component.prototype[usage] = function() {
            return handler.apply(this, arguments)
        }
    }
    return wc
}

let wcExt = wc.prototype = {
    ctor: function(id) {
        let cmp = cmps[id]

        if (!cmp) {
            cmp = cmps[id] = new Component(id)
            cmp.state = 0
        }

        this.cmp = cmp

        return this
    },
    /**
     * 当前坐落在哪个容器上
     */
    at: function(ctx, options) {
        if (ctx) {
            if (isArray(ctx)) {

                /**
                 * 如果一个组件坐落在当前页面的做个容器中,即组件出现了复用情况
                 *
                 *  例如一个页面多个数据展示列表,但都是用到得了名称`grid`的组件
                 *
                 *  此种情况下,需要执行组件copy
                 *
                 *  copy的算法: 将内部除id外所有的属性都实现直接复制, 新的组件id以版本号叠加的形式闯将
                 *
                 */
                let len = ctx.length - 1
                this.cmp.ctx = ctx[len]

                for (; len--;) {

                    this.copy = this.copy || []

                    let newId = this.cmp.id + '_v' + len

                    this.copy.push(cmps[newId] = new Component(newId, options || this.cmp.options, this.cmp.factory))
                }

            } else {
                this.cmp.ctx = ctx
            }
        }

        return this
    },
    /**
     *
     * 当前组件主动订阅发布方事件
     *
     *  建议发布/订阅的关系
     *
     * @param {String} publisherCMPID  发布方组件id
     * @param {String|Array} publisherEvents 待订阅的发布方的事件列表
     * @param {String} subscriberEventName 当前这对订阅的发布方事件的关联响应事件
     */
    sub: function(publisherCMPID, publisherEvents, subscriberEventName) {

        if (!isArray(publisherEvents)) publisherEvents = [publisherEvents]

        let tracer, len = publisherEvents.length

        for (; len--;) {

            tracer = EventTracer.get(Component.nameFn(publisherCMPID, publisherEvents[len]))

            if (tracer) {
                tracer.addSub(subscriberEventName, this.cmp.id)
                if (this.copy && this.copy.length) {
                    for (let l2 = this.copy.length; l2--;) {
                        tracer.addSub(subscriberEventName, this.copy[l2].id)
                    }
                }
                continue
            }

            tracer = new EventTracer(publisherEvents[len], publisherCMPID)

            tracer.addSub(this.cmp.id, subscriberEventName)

            if (this.copy && this.copy.length) {
                for (let l2 = this.copy.length; l2--;) {
                    tracer.addSub(this.copy[l2].id, subscriberEventName)
                }
            }

            EventTracer.set(tracer)
        }

        return this
    }
}

wcExt.ctor.prototype = wcExt
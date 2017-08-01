import CMP from './CMP'

import TopicCenter from './topic-center'

import {
    print,
    extend,
    isObject
} from './util'

import { ERRFLAG, conf, allowUsage, allowBrowserTopics, injectors, topics, remain_cmps, cmps, STATE } from './variable'

const wc = {}

function loadCombo(needComboCmps, needload) {

    if (!conf.combo) return

    l = needComboCmps ? needComboCmps.length : 0

    if (!l) return

    let cmpids = needComboCmps.join(',')

    for (l = needComboCmps.length; l--;) {
        cmps[needComboCmps[l]].state = STATE.fetching
    }

    let sperator = conf.combo.sperator || '??'

    if (conf.combo.css_root) {
        injectors.res.fetch(conf.combo.css_root + sperator + cmpids)
    }
    if (conf.combo.js_root) {
        injectors.res
            .fetch(conf.combo.js_root + sperator + cmpids)
            .then(() => {
                for (l = needComboCmps.length; l--;) {
                    if (needload) {
                        CMP.load(cmps[needComboCmps[l]])
                        remain_cmps[needComboCmps[l]] && delete remain_cmps[needComboCmps[l]]
                    } else {
                        cmps[needComboCmps[l]].state = STATE.fetched
                    }
                }
            })
    }
}

/**
 * 定义组件
 * @param  {String} id      组件id
 * @param  {Object-KV} options 组件初始配置项
 * @param  {Function} factory 组件的工厂构造方法
 * @return {WC}         WC对象
 */
wc.cmp = function(id, options, factory) {
    if (!id)
        return print(ERRFLAG.E101)

    let cmp = cmps[id]

    if (!cmp) {
        cmp = cmps[id] = new CMP(id, options, factory)
    } else {
        //合并opts和更新factory
        cmp.fac = factory
        cmp.opts = extend(cmp.opts, options)
    }

    cmp.state = STATE.fetched

    return this
}

/**
 *
 * 初始化配置
 *   options配置项清单如下:
 *     `combo`: [Boolean] 是否启用在线combo (Default:false)
 *     `tpl` [`Boolean`] 是否启用模板操作 (Default:false)
 *     `anim`:[`Boolean`] 是否启用动画操作 (Default:false)
 *     `cmps`:[`Array`] 当前页面的组件之间的依赖配置
 *            `id`:[`String`] 组件id
 *            `deps`: 
 *              {   
 *                  'topic': [
 *                      {'id':'','topics':'',__trace:{
 *                          'time': cbdatas --- [[sub_fb_cbs]]
 *                      }}
 *                  ]{
 *                      '__trace':{
 *                          'time': data,
 *                          'time2': data2,
 *                      }
 *                  }
 *              },
 *            `opts`: {''} 组件在当前页面宿主中的配置
 *            `ctx`: 组件的内嵌容器元素的元素选择器字符串,
 *            `usage`:
 *            [
 *              {
 *                `ctx`:[`String`] 组件在当前页面所在的容器
 *                `opts`: [`Object-KV`] 组件在当前容器的配置--宿主环境配置
 *              }
 *            ]
 * @param  {Object-KV} options 配置项
 * @return {WC}
 */
wc.conf = function(options) {

    for (let usage, l = allowUsage.length; l--;) {
        conf[usage = allowUsage[l]] = !(usage in options) ? true : !!options[usage]
    }

    conf.util = true

    conf.threshold = options.threshold || 0

    let item,
        l = allowUsage.length
        //如果有则加载,没有的话就执行强制注入
    for (; l--;) {
        item = allowUsage[l]
        conf[item] && Object.defineProperty(CMP.prototype, item, {
            writable: false,
            configurable: false,
            value: injectors[item]
        })
    }

    l = options.cmps.length

    let cmp, items, l2, l3

    for (; l--;) {

        item = options.cmps[l]

        cmp = cmps[item.id]

        if (!cmp) {
            //创建一个CMP对象
            cmp = new CMP(item.id, item.opts)
        } else {
            //更新options
            cmp.opts = item.opts ? extend(cmp.opts, item.opts) : cmp.opts
        }

        cmp.deps = item.deps

        if (item.ctx) {
            cmp.ctx = item.ctx
        } else {
            items = item.usage
            if (items) {
                let item
                for (l2 = items.length; l2--;) {
                    item = items[l2]
                    if (item.ctx) {
                        if (!cmp.ctx) {
                            cmp.ctx = item.ctx
                            if (item.opts) {
                                cmp.opts = extend(cmp.opts, item.opts)
                            }
                        } else if (cmp.ctx === item.ctx) {
                            if (item.opts) {
                                cmp.opts = extend(cmp.opts, item.opts)
                            }
                        } else {
                            let cmpNew = new CMP(cmp.id + item.ctx, item.opts, cmp.fac)
                            cmpNew.ctx = item.ctx
                            cmpNew.deps = item.deps
                            cmps[cmpNew.id] = cmpNew
                        }
                    }
                }
            }
        }
    }

    conf.combo = options.combo

    if (options.debug) {
        let data = wc.data = {}
        data.cmps = cmps
        data.topics = topics
        data.injectors = injectors
    }

    return wc
}

/**
 * 用户自定义替换wc内部的特定用途的对象
 * @param  {String} usage ['http','tpl','$','anim','util']
 * @param  {Function|Object-KV} injectKV 注入对象
 * @param  {Boolean} replace 是否覆盖现有的实现 默认false
 * @return {[type]}       [description]
 */
wc.inject = function(usage, injectKV, replace) {

    if (arguments.length < 2) {
        print(ERRFLAG.W102)
        return this
    }
    if (replace) {
        injectors[usage] = injectKV
    } else {
        if (!isObject(injectKV)) {
            print(ERRFLAG.W103)
            return this
        }

        let oldVal = injectors[usage] || (injectors[usage] = {})

        let extend = usage === 'util' ? oldVal.extend : injectors.util.extend

        if (extend) {
            extend(oldVal, injectKV)
        } else {
            for (let i in injectKV) {
                oldVal[i] = injectKV
            }
        }
    }

    return wc
}

/**
 * 发布主题
 * @param  {String} hostTopic   主题名称(宿主作为发布者的主题: ready、load、scroll、resize)
 * @param  {Object} context 数据
 * @return {wc}         [description]
 */
wc.pub = function(hostTopic, context) {

    //查找当前发布者对应的订阅者,判断他们的状态
    if (!hostTopic) return this

    if (allowBrowserTopics.includes(hostTopic)) {
        TopicCenter.emit([hostTopic], context)
    }

    return this
}

/**
 * @param {Boolean} loadmore 是否加载更多,当为true的时候表示要加载剩余组件的概念
 */
wc.load = function(loadmore) {

    let cmp, l, reqids = []

    let isVisable = injectors.util.isInVisualArea

    if (loadmore) {
        for (l = remain_cmps.length; l--;) {
            cmp = remain_cmps[l]
            if (!isVisable(cmp.ctx, conf.threshold)) continue
            reqids.push(cmp.id)
        }
    } else {
        for (let cmpId in cmps) {
            cmp = cmps[cmpId]
            switch (cmp.state) {
                case STATE.fetched:
                    CMP.load(cmp)
                    break
                case STATE.unfetch:
                    isVisable(cmp.ctx, conf.threshold) ? reqids.push(cmpId) : remain_cmps.push(cmpId)
                    break
            }
        }
    }
    reqids.length && loadCombo(reqids, true)
}

window.wc = wc
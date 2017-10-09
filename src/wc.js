import { cmps, conf, waitingSubscribers, allowFns } from './variable'

import { isFunction, isObject } from './util'

import { events } from './event-bus'

import wcExt from './wc-ext'

import Component from './cmp'

/**
 * wc 全局对象
 * 
 * @param {String} id - 组件id
 * @param {Boolean} ctxSync - 是否将id同步成组件的容器
 */
const wc = window.wc = function wc(id, ctxSync) {
  return wcExt.ctor(id, ctxSync)
}

/**
 * 兼容 commonjs、 amd、cmd模式
 */
if (typeof define === 'function') {
  if (define.amd) {
    define('wc', [], () => wc)
  } else if (define.cmd) {
    define((require, exports, module) => {
      module.exports = wc
    })
  }
} else if (typeof module !== 'undefined' && typeof exports === 'object') {
  module.exports = wc
}

/**
 * wc 当前版本号
 */
wc.version = '0.0.1'

/**
 * 定义wc组件
 * 
 * @param {String} id - 组件自定义唯一标识名称
 * @param {Object} [opts] - 组件的可选配置(解决组件的自适应宿主性)
 * @param {Function} factory - 组件的构造工厂
 */
wc.define = function(id, opts, factory) {
  if (!id) return
  let cmp = cmps[id]

  if (!factory && isFunction(opts)) {
    factory = opts
    opts = null
  }

  if (!cmp) {
    cmp = cmps[id] = new Component(id, opts, factory)
  } else {
    //合并opts和更新factory
    cmp.fac = factory
    opts && (cmp.opts = cmp.opts ? Object.assign(cmp.opts, opts) : opts)
  }
  cmp.state = 2
}

/**
 * wc针对当前页面的组件消息配置
 * 
 * @param {Object} options - 针对当前页面的数据配置项
 * @param {Boolean} [options.debug=false] - 是否开启调试模式
 * @param {Number} [options.threshold=0] - 页面滚动/resize时执行按需加载组件的阈值
 * @param {Object} [options.combo] - 按需异步加载组件时候的请求地址(建议是具有combo特性的服务端请求地址)
 */
wc.config = function(options) {

  if (options.debug) {
    wc.data = {
      cmps: cmps,
      waitingSubscribers: waitingSubscribers,
      events: events
    }
  }

  conf.threshold = options.threshold || 0

  conf.combo = options.combo
}

/**
 * wc扩展操作定义/覆盖
 * 
 * @param {String} name - 扩展操作的名称
 * @param {Function} handler - 扩展操作的处理器
 */
wc.fn = function(name, handler) {

  if (!allowFns.includes(name)) return this

  let proto = Component.prototype

  if (isFunction(handler)) {
    proto[name] = function() {
      return handler.apply(this, arguments)
    }
  } else if (isObject(handler)) {

    let oldHandler = proto[oldHandler]

    proto[name] = oldHandler ? Object.assign(oldHandler, handler) : handler
  }
}

export default wc
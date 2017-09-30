import { cmps } from './variable'

import { isArray, isObject } from './util'

import Component from './cmp'

import EventTracer from './event-tracer'


const wcExt = {
  /**
   * 初始化组件或者补全组件
   *  
   *  如果找到该组件则保留该组件引用,反之先创建在持有引用
   * 
   * @param {String} id - 组件id
   * @param {Boolean} ctxSync - 是否将id同步成组件的容器
   */
  ctor: function(id, ctxSync) {

    this.cmp = cmps[id] || (cmps[id] = new Component(id))

    if (ctxSync) this.cmp.ctx = '#' + id

    return this
  },

  /**
   * 当前组件寄宿在页面的配置
   * 
   * @param {String|Array} [ctx] 当前组件将要寄宿在页面的容器的筛选条件
   */
  host: function(ctx, options) {
    let self = this

    if (!self.cmp) return self

    let cmp = self.cmp

    if (arguments.length === 1) {
      if (isObject(arguments[0])) {
        options = ctx
        ctx = null
      }
    }

    if (!ctx) {
      cmp.ctx = '#' + cmp.id
      cmp.opts = options
    } else if (isArray(ctx)) {

      /**
       * 如果一个组件坐落在当前页面的做个容器中,即组件出现了复用情况
       *
       *  例如一个页面多个数据展示列表,但都是用到得了名称`grid`的组件
       *
       *  此种情况下,需要执行组件copy
       *
       *  copy的算法: 将内部除id外所有的属性都实现直接复制, 新的组件id以版本号叠加的形式创建
       *
       */
      let len = ctx.length - 1

      cmp.ctx = ctx[len]

      for (; len--;) {

        self.copy = self.copy || []

        let newId = cmp.id + '_v' + len

        self.copy.push(cmps[newId] = new Component(newId, options || cmp.options, cmp.factory))
      }
    } else {
      cmp.ctx = ctx
      options && (cmp.opts = cmp.opts ? Object.assign(cmp.opts, options) : options)
    }

    return self
  },

  /**
   * 记录当前组件的订阅请求
   *  
   *    规则: 
   *      1. 当前组件可以作为订阅者去订阅其他组件公开出来的发布主题事件
   *      2. 订阅方需要提供一个注册到了eventbus中心的事件名称来接收订阅方主题的调用结果
   *      3. 一个订阅方可以订阅多个发布方主题, 一个订阅方的接收主题可以对应多个发布方主题的调用
   * 
   * @param {String} cmpID - 发布方组件ID
   * @param {String|Array} cmpEvts - 发布方组件公开出来的可订阅主题名称
   * @param {String} receiverEvt - 订阅方用于接收发布方主题调用结果的已在eventbus中心注册的事件名称
   */
  sub: function(cmpID, cmpEvts, receiverEvt) {

    if (!isArray(cmpEvts)) cmpEvts = [cmpEvts]

    let tracer, len = cmpEvts.length

    for (; len--;) {

      tracer = EventTracer.get(Component.nameFn(cmpID, cmpEvts[len]))

      if (tracer) {
        tracer.addSub(receiverEvt, this.cmp.id)
        if (this.copy && this.copy.length) {
          for (let l2 = this.copy.length; l2--;) {
            tracer.addSub(receiverEvt, this.copy[l2].id)
          }
        }
        continue
      }

      tracer = new EventTracer(cmpEvts[len], cmpID)

      tracer.addSub(this.cmp.id, receiverEvt)

      if (this.copy && this.copy.length) {
        for (let l2 = this.copy.length; l2--;) {
          tracer.addSub(this.copy[l2].id, receiverEvt)
        }
      }

      EventTracer.set(tracer)
    }

    return this
  }
}

wcExt.ctor.prototype = wcExt

export default wcExt
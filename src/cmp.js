import { waitingSubscribers, cmps, conf, hookActions } from './variable'

import ebus from './event-bus'

import EventTracer from './event-tracer'

/**
 * 组件的定义
 *
 * 1. 最基础的组件定义
 *      * `id`
 *      * `opts`
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
 * @class {Object} Component - 组件类
 * 
 * 
 * @param {String} id - 组件id
 * @param {Object} [options] - 组件自适应宿主的配置项
 * @param {Function} factory - 组件构建工厂函数
 */
export default function Component(id, options, factory) {

  this.id = id

  this.opts = options || {}

  this.fac = factory

  //组件的状态
  this.state = 0 //unfetched
}

/**
 * wc事件名称分隔符
 */
const EVENT_SPERATOR = '_'

/**
 * 组件完整事件名称命名方法
 * 
 * @param {String} cmpID - 组件ID
 * @param {String} evtName - 事件名称
 * 
 * @return {String} - 完整的wc内部事件名称
 */
Component.nameFn = function(cmpID, evtName) {
  return cmpID + EVENT_SPERATOR + evtName
}

Component.prototype = {
  constructor: Component,
  /**
   * 
   * 组件针对当前页面的挂钩
   *  主要可以挂在如下事件:
   *    
   *    1. ready : DOMContentLoaded
   *    2. onLoad: window.onload
   *    3. onScroll: window窗口的scroll监听
   *    4. onResize: window窗口的resize监听
   *    5. beforeLeave: window窗口的关闭前事件
   *    
   * @member {Function} hook
   */
  hook: function(key, cb) {

    if (!hookActions.includes(key)) return this

    let fullEvtName = Component.nameFn(this.id, key)

    ebus.on(fullEvtName, cb.bind(Component.eventRicher), key === 'ready' || key === 'onLoad')

    //注册组件__env__与此组件的关联关系

    let tracer = EventTracer.get(Component.nameFn('__env__', key))
    if (!tracer) {
      EventTracer.set(tracer = new EventTracer(key, '__env__'))
    }

    tracer.addSub(this.id, key)

    return this
  },

  /**
   * 组件注册事件至内部eventbus中,便于组件之间的事件交互
   * 
   * @param {String} evtName - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  on: function(evtName, handler) {
    ebus.on(Component.nameFn(this.id, evtName), handler.bind(Component.eventRicher))
    return this
  },

  /**
   * 组件发布事件
   *  
   *  此处新增了对于订阅方反馈信息接收的处理:模式有点变成类似req/res模式   
   * 
   * @param {String} evtName - 事件名称
   * @param {Object} [data] - 事件发送时传输的数据
   * @param {Function} [cb] - 接收订阅方反馈的回调处理
   */
  pub: function(evtName, data, cb) {

    let fullEvtName = Component.nameFn(this.id, evtName)

    let tracer = EventTracer.get(fullEvtName)

    //没有找到此发布方事件的发布订阅关系
    if (!tracer) return this

    let subscribersKV = tracer.subs,
      totalSubLen = 0,
      subCmpID, subEvtArr, subEvtArrLen, subCmp,
      waitingSubEvtMapKV

    //此次事件追踪没有找到当前事件的订阅方
    if (!subscribersKV) return this

    //生成针对当前组件正在发布事件的追踪记录器,用于记录此次交互的轨迹
    let tracerRecorder = tracer.record(fullEvtName, this.id)

    //记录需要fetch的组件数组
    let waitingFetchCMPs = []

    for (subCmpID in subscribersKV) {

      /**
       * 优先级:
       *  1.先判断此订阅方组件是否存在;
       *  2.然后判断是否绑定了对应的接收事件
       */

      //寻找此订阅方组件对象
      subCmp = cmps[subCmpID]
      if (!subCmp) {
        delete subscribersKV[subCmpID]
        continue
      }

      //寻找当前订阅方对应的接收事件数组
      subEvtArr = subscribersKV[subCmpID]
      //当前订阅方没有指定对应的接收处理事件
      if (!subEvtArr) continue
      if (!subEvtArr.length) {
        delete subscribersKV[subCmpID]
        continue
      }

      subEvtArrLen = subEvtArr.length

      //记录当前发布方对应的订阅方接收事件总数
      totalSubLen += subEvtArrLen

      //如果订阅方组件的状态是unfetch(0)或者fetching(1)的状态,则将此次调用申请推送至等待缓存区中
      if (subCmp.state === 0 || subCmp.state === 1) {

        if (subCmp.state === 0) waitingFetchCMPs.push(subCmpID)

        //寻找交互订阅方缓冲区中的订阅方事件映射
        waitingSubEvtMapKV = waitingSubscribers[subCmpID]

        if (!waitingSubEvtMapKV) continue

        for (; subEvtArrLen--;) {

          let waitingSubEvtMapItemArr = waitingSubEvtMapKV[subEvtArr[subEvtArrLen]]

          //如果没有发布订阅的映射---即初次
          if (!waitingSubEvtMapItemArr) {
            waitingSubEvtMapItemArr[subEvtArr[subEvtArrLen]] = [{
              cmp: this.id,
              evt: evtName,
              data: data
            }]
          } else {
            let isRepeat = false

            //遍历得到此次交互过程是否有历史堆积,如果有则覆盖过去的
            for (let waitingSubEvtMapItemArrLen = waitingSubEvtMapItemArr.length; waitingSubEvtMapItemArrLen--;) {
              let mapItem = waitingSubEvtMapItemArr[waitingSubEvtMapItemArrLen]
              if (mapItem.cmp === this.id && mapItem.evt === evtName) {
                mapItem.data = data
                isRepeat = true
              }
            }
            if (!isRepeat) {
              waitingSubEvtMapItemArr.push({
                cmp: this.id,
                evt: evtName,
                data: data
              })
            }
          }
        }

        /**
         * 下载`waitingFetchCMPs`中记录的unfetch(0)组件
         *   前提:需要借助扩展的http操作
         */
        if (!waitingFetchCMPs.length || this.http) continue

        let len = waitingFetchCMPs.length

        if (conf.combo) {

          let url = conf.combo(waitingFetchCMPs, 'js')

          for (; len--;) cmps[waitingFetchCMPs[len]].state = 1

          len = waitingFetchCMPs.length

          this
            .http(url)
            .then(() => {
              for (; len--;)
                Component.load(cmps[waitingFetchCMPs[len]])
            })
            .catch(() => {
              for (; len--;)
                cmps[waitingFetchCMPs[len]].state = 4 //失败 error
            })

          url = conf.combo(waitingFetchCMPs, 'css')

          this.http(url).catch(err => console.log(err))

        }

        continue
      }

      for (; subEvtArrLen--;) {
        ebus.emit(
          Component.nameFn(subCmpID, subEvtArr[subEvtArrLen]),
          data,
          tracerRecorder
        )
      }
    }

    tracer.sublen = totalSubLen
    tracer.cb = cb
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
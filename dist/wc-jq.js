(function () {
'use strict';

/**
 * 所有等待被唤醒的事件键值集合
 *
 *  数据结构要求:
 *  1. 能够实现订阅方所属组件id的快速定位
 *  2. 能够包含到从发布方到订阅方的过程信息
 * struct:
 *  {
 *      "subscriber.cmp":{
 *             "subscriber.evt":[{
 *                  "cmp":"cmp2",
 *                  "evt":"evt1",
 *                  "data": "data"
 *             }]
 *      }
 *  }
 *
 * @type {Object}
 */
var waitingSubscribers = {};

/**
 * 框架的组件集合
 * @type {[type]}
 */
var cmps = {};

/**
 * 剩余的还未装载成功的组件id列表
 * @type {[type]}
 */
var remainCmps = [];

/**
 * 框架的配置信息
 * @type {Object}
 */
var conf = {};

/**
 * 可以被允许注入的
 * @type {Array}
 */
var allowFns = ['$', 'http', 'tpl', 'anim', 'cache', 'util'];

/**
 * 浏览器宿主允许被订阅的主题
 * @type {Array}
 */
var hookActions = ['ready', 'onLoad', 'onScroll', 'onResize', 'beforeLeave'];

function isType(type) {
  return function (obj) {
    return Object.prototype.toString.call(obj) === '[object ' + type + ']';
  };
}

var isArray = Array.isArray || isType('Array');

var isFunction = isType('Function');

var isObject = isType('Object');

/**
 * 存储所有事件的对象
 * @type {Object}
 */
var events = {};

/**
 * a publish / subscribe event bus
 */
var ebus = {

  /**
   * 注册事件至事件总线中
   *
   *  事件的注册是覆盖形式的,如果出现重名事件不同顺序注册的情况
   *
   * @param {String} evtName 事件名称
   * @param {Function} handler 事件处理函数
   * @param {Boolean} [isOnce=false] 是否是作为只消费一次的事件
   */
  on: function on(evtName, handler, isOnce) {

    if (!evtName || !handler) return this;

    var _cb2 = handler;

    if (isOnce) {

      var fire = false,
          _cb = handler;

      _cb2 = function cb() {
        ebus.off(evtName, _cb2);
        if (!fire) {
          fire = true;
          _cb.apply(this, arguments);
        }
      };
    }

    for (var list, l = (evtName = evtName.split(',')).length; l--;) {
      list = events[evtName[l]] || (events[evtName[l]] = []);
      list.push(_cb2);
    }

    return this;
  },

  /**
   * 移除在事件总线中已注册的事件
   *
   *  移除方式:
   *      1. 只提供事件名称
   *      2. 即提供事件名称以及事件处理函数
   *      3. 删除所有
   *
   * @param {String} evtName 事件名称
   * @param {Function} handler  事件处理函数
   * @memberof ebus
   * @returns {Object} ebus
   */
  off: function off(evtName, handler) {

    // Remove all events
    if (!(evtName || handler)) {
      events = {};
      return this;
    }

    var list = events[evtName],
        l = void 0;

    if (list && (l = list.length)) {
      if (!handler) {
        // Remove all events
        delete events[evtName];
      } else {
        for (; l--;) {
          if (list[l] === handler) list.splice(l, 1);
        }
      }
    }

    return this;
  },


  /**
   * 发出事件
   *
   * @param {String|Array} evtName 事件名称
   * @param {any} data 发出数据
   * @param {Function} tracerRecorder 事件发布订阅过程的站点记录函数
   */
  emit: function emit(evtName, data, tracerRecorder) {

    if (!evtName) return;

    if (!isArray(data)) data = [data];

    var list = void 0,
        l2 = void 0;

    if (!isArray(evtName)) {

      list = events[evtName];

      if (!list || !(l2 = list.length)) return;

      tracerRecorder && tracerRecorder.sub(evtName, l2);

      list = list.slice();

      for (; l2--;) {

        tracerRecorder && tracerRecorder.hndIdx(l2);

        list[l2].apply(null, data);
      }

      return;
    }
    for (var i = 0, l = evtName.length; i < l; i++) {

      list = events[evtName[i]];

      if (!list || !(l2 = list.length)) continue;

      tracerRecorder && tracerRecorder.sub(evtName[i], l2);

      list = list.slice();

      for (; l2--;) {

        tracerRecorder && tracerRecorder.hndIdx(l2);

        list[l2].apply(null, data);
      }
    }
  }
};

/**
 * 事件发布订阅过程的追踪对象缓存列表
 */
var tracerCaches = {};

/**
 * 当前追踪游标
 */
var cursor = {};

/**
 * 信号串分隔符
 * {String}
 */
var SIGNALSEPRATOR = '::';

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
 * @param {String} publisherFullEvtName 发布方事件
 * @param {String} cmp 发布方所属组件
 */
function EventTracer(publisherFullEvtName, cmp) {
  this.cmp = cmp;
  this.evt = publisherFullEvtName;
  this.subs = {};
  this.times = {};
  this.cb = null;
  this.sublen = 0;
}

EventTracer.prototype = {

  constructor: EventTracer,

  /**
   * 新增当前事件发布过程中待追踪的订阅方
   *
   * @param {String} cmpid 订阅方组件id
   * @param {String} evtName 订阅方的事件名称
   */
  addSub: function addSub(cmpid, evtName) {
    var evts = this.subs[cmpid];
    if (!evts) {
      this.subs[cmpid] = [evtName];
    } else {
      evts.push(evtName);
    }
  },

  /**
   * 记录当前的事件发布订阅过程所流转到的订阅方以及订阅方的处理器索引
   *
   * @param {any} curPublisher 当前订阅方事件名称
   * @param {any} curCmp 当前订阅方组件id
   */
  record: function record(publisherCMPID, publisherFullEventName) {
    cursor.c = publisherCMPID;
    cursor.p = publisherFullEventName;
    cursor.t = new Date().getTime();

    var times = this.times[cursor.t] = { __oklen: 0 };

    return {
      sub: function sub(subscriberFullEventName, subscriberHandlersLength) {
        cursor.s = subscriberFullEventName;
        if (!times[subscriberFullEventName]) {
          times[subscriberFullEventName] = {
            len: subscriberHandlersLength || 0,
            datas: []
          };
        }
      },
      hndIdx: function hndIdx(_hndIdx) {
        cursor.hndIdx = _hndIdx;
      }
    };
  }

  /**
   * 生成/解析事件信号串
   */
};EventTracer.signal = function (value, data) {

  if (!value) {
    //生成信号串
    return cursor.c + SIGNALSEPRATOR + cursor.p + SIGNALSEPRATOR + cursor.t + SIGNALSEPRATOR + cursor.s + SIGNALSEPRATOR + cursor.hndIdx;
  } else {
    //解析信号串

    var arr = value.split(SIGNALSEPRATOR);

    var tracer = tracerCaches[arr[1]];

    if (!tracer) return;

    var timeItem = tracer.times[arr[2]];

    if (!timeItem) return;

    var subsItem = timeItem[arr[3]];

    if (!subsItem) return;

    subsItem.datas[arr[4]] = data;

    if (subsItem.len === subsItem.datas.length) {
      timeItem.__oklen += 1;
    }

    if (timeItem.__oklen === tracer.sublen) {
      //此次发布订阅过程已经结束
      if (tracer.cb) {

        //获取所有数据
        var _arr = [];

        delete timeItem.__oklen;

        for (var subscriber in timeItem) {
          delete timeItem[subscriber].len;
          _arr.push(timeItem[subscriber]);
        }

        tracer.cb.apply(null, _arr);
      }
      //删除这个发布订阅过程
      tracer.times[arr[2]] = null;
    }
  }
};

/**
 * 获取事件追踪对象
 *
 * @param {String} publisherFullEventName 事件发布方名称
 * @return {EventTracer|Null} 事件追踪对象
 */
EventTracer.get = function (publisherFullEventName) {
  return publisherFullEventName ? tracerCaches[publisherFullEventName] : null;
};

/**
 * 存储事件追踪对象
 */
EventTracer.set = function (tracer) {
  if (tracer) {
    tracerCaches[Component.nameFn(tracer.cmp, tracer.evt)] = tracer;
  }
};

function FSM(state) {
  this._trans = {};
  this._prev = null;
  this._state = state;
}

FSM.prototype = {
  constructor: FSM,

  trans: function trans(config) {

    var trans = this._trans;

    var state = this._state === config.from ? this._state : config.from;

    var kv = trans[state] || (trans[state] = {});

    kv[config.name] = config;

    return this;
  },

  transit: function transit() {

    var args = Array.prototype.slice.apply(arguments);

    var trankv = this._trans[this._state];

    if (!trankv) {
      throw new Error('当前组件不具备从状态-' + this._state + '开始的变迁');
    }

    var tran = trankv[args.shift()];

    if (!tran) return;

    var from = tran.from;

    if (from === '*' || from === this._state || from.includes(this._state)) {

      this._prev = this._state;

      tran.before && tran.before.apply(null, args);

      this._state = tran.to;

      tran.after && tran.after.apply(null, args);
    } else {
      throw new Error('组件不能从' + this._state + '转换至' + tran.to + '状态');
    }
  }
};

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
function Component(id, options, factory) {

  this.id = id;

  this.opts = options || {};

  this.fac = factory;

  //组件的状态
  this.state = 0; //unfetched
}

/**
 * wc事件名称分隔符
 */
var EVENT_SPERATOR = '_';

/**
 * 组件完整事件名称命名方法
 * 
 * @param {String} cmpID - 组件ID
 * @param {String} evtName - 事件名称
 * 
 * @return {String} - 完整的wc内部事件名称
 */
Component.nameFn = function (cmpID, evtName) {
  return cmpID + EVENT_SPERATOR + evtName;
};

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
  hook: function hook(key, cb) {

    if (!hookActions.includes(key)) return this;

    var fullEvtName = Component.nameFn(this.id, key);

    ebus.on(fullEvtName, cb.bind(Component.eventRicher), key === 'ready' || key === 'onLoad'

    //注册组件__env__与此组件的关联关系

    );var tracer = EventTracer.get(Component.nameFn('__env__', key));
    if (!tracer) {
      EventTracer.set(tracer = new EventTracer(key, '__env__'));
    }

    tracer.addSub(this.id, key);

    return this;
  },

  /**
   * 组件注册事件至内部eventbus中,便于组件之间的事件交互
   * 
   * @param {String} evtName - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  on: function on(evtName, handler) {
    ebus.on(Component.nameFn(this.id, evtName), handler.bind(Component.eventRicher));
    return this;
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
  pub: function pub(evtName, data, cb) {
    var _this = this;

    var fullEvtName = Component.nameFn(this.id, evtName);

    var tracer = EventTracer.get(fullEvtName

    //没有找到此发布方事件的发布订阅关系
    );if (!tracer) return this;

    var subscribersKV = tracer.subs,
        totalSubLen = 0,
        subCmpID = void 0,
        subEvtArr = void 0,
        subEvtArrLen = void 0,
        subCmp = void 0,
        waitingSubEvtMapKV = void 0;

    //此次事件追踪没有找到当前事件的订阅方
    if (!subscribersKV) return this;

    //生成针对当前组件正在发布事件的追踪记录器,用于记录此次交互的轨迹
    var tracerRecorder = tracer.record(fullEvtName, this.id

    //记录需要fetch的组件数组
    );var waitingFetchCMPs = [];

    for (subCmpID in subscribersKV) {

      /**
       * 优先级:
       *  1.先判断此订阅方组件是否存在;
       *  2.然后判断是否绑定了对应的接收事件
       */

      //寻找此订阅方组件对象
      subCmp = cmps[subCmpID];
      if (!subCmp) {
        delete subscribersKV[subCmpID];
        continue;
      }

      //寻找当前订阅方对应的接收事件数组
      subEvtArr = subscribersKV[subCmpID];
      //当前订阅方没有指定对应的接收处理事件
      if (!subEvtArr) continue;
      if (!subEvtArr.length) {
        delete subscribersKV[subCmpID];
        continue;
      }

      subEvtArrLen = subEvtArr.length;

      //记录当前发布方对应的订阅方接收事件总数
      totalSubLen += subEvtArrLen;

      //如果订阅方组件的状态是unfetch(0)或者fetching(1)的状态,则将此次调用申请推送至等待缓存区中
      if (subCmp.state === 0 || subCmp.state === 1) {
        var _ret = function () {

          if (subCmp.state === 0) waitingFetchCMPs.push(subCmpID

          //寻找交互订阅方缓冲区中的订阅方事件映射
          );waitingSubEvtMapKV = waitingSubscribers[subCmpID];

          if (!waitingSubEvtMapKV) return 'continue';

          for (; subEvtArrLen--;) {

            var waitingSubEvtMapItemArr = waitingSubEvtMapKV[subEvtArr[subEvtArrLen]];

            //如果没有发布订阅的映射---即初次
            if (!waitingSubEvtMapItemArr) {
              waitingSubEvtMapItemArr[subEvtArr[subEvtArrLen]] = [{
                cmp: _this.id,
                evt: evtName,
                data: data
              }];
            } else {
              var isRepeat = false;

              //遍历得到此次交互过程是否有历史堆积,如果有则覆盖过去的
              for (var waitingSubEvtMapItemArrLen = waitingSubEvtMapItemArr.length; waitingSubEvtMapItemArrLen--;) {
                var mapItem = waitingSubEvtMapItemArr[waitingSubEvtMapItemArrLen];
                if (mapItem.cmp === _this.id && mapItem.evt === evtName) {
                  mapItem.data = data;
                  isRepeat = true;
                }
              }
              if (!isRepeat) {
                waitingSubEvtMapItemArr.push({
                  cmp: _this.id,
                  evt: evtName,
                  data: data
                });
              }
            }
          }

          /**
           * 下载`waitingFetchCMPs`中记录的unfetch(0)组件
           *   前提:需要借助扩展的http操作
           */
          if (!waitingFetchCMPs.length || _this.http) return 'continue';

          var len = waitingFetchCMPs.length;

          if (conf.combo) {

            var url = conf.combo(waitingFetchCMPs, 'js');

            for (; len--;) {
              cmps[waitingFetchCMPs[len]].state = 1;
            }len = waitingFetchCMPs.length;

            _this.http(url).then(function () {
              for (; len--;) {
                Component.load(cmps[waitingFetchCMPs[len]]);
              }
            }).catch(function () {
              for (; len--;) {
                cmps[waitingFetchCMPs[len]].state = 4;
              } //失败 error
            });

            url = conf.combo(waitingFetchCMPs, 'css');

            _this.http(url).catch(function (err) {
              return console.log(err);
            });
          }

          return 'continue';
        }();

        if (_ret === 'continue') continue;
      }

      for (; subEvtArrLen--;) {
        ebus.emit(Component.nameFn(subCmpID, subEvtArr[subEvtArrLen]), data, tracerRecorder);
      }
    }

    tracer.sublen = totalSubLen;
    tracer.cb = cb;
  },
  /**
   * 呼叫自身内部主题
   * 
   * @param {String} evtName - 内部"on"定义的事件名称
   * @param {Object|Array<Object>} [data] - 事件所需传递的参数
   */
  callSelf: function callSelf(evtName, data) {
    ebus.emit(Component.nameFn(this.id, evtName), data);
    return this;
  }

  /**
   * 丰富组件事件发布订阅处理
   */
};Component.eventRicher = {
  /**
   * 暂停当前事件发布订阅传输的路线
   *
   * @return 返回当前事件发布订阅的运行信号串
   */
  pause: function pause() {
    return EventTracer.signal();
  },

  /**
   * 恢复当前信号串所对应的发布订阅过程
   */
  resume: function resume(signal, data) {
    EventTracer.signal(signal, data);
  }

  /**
   * 装载组件
   */
};Component.load = function (cmp) {

  !cmp.fsm && (cmp.fsm = function (state) {
    return new FSM(state);
  });

  var factory = cmp.fac;

  factory.call(cmp);

  cmp.state = 3;

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
  var subscribers = waitingSubscribers[cmp.id];

  var pubArr = void 0,
      pubArrLen = void 0,
      pub = void 0,
      tracer = void 0,
      publisherEvt = void 0;

  for (var sub in subscribers) {

    pubArr = subscribers[sub];

    if (!pubArr || !pubArr.length) {
      delete subscribers[sub];
      continue;
    }

    for (pubArrLen = pubArr.length; pubArrLen--;) {

      pub = pubArr[pubArrLen];

      tracer = EventTracer.get(publisherEvt = Component.nameFn(pub.cmp, pub.evt));

      if (!tracer) {
        //删除数组元素
        pubArr.splice(pubArrLen, 1);
        continue;
      }

      var tracerRecorder = tracer.record(publisherEvt, pub.cmp);

      ebus.emit(Component.nameFn(cmp.id, sub), pub.data, tracerRecorder);
    }
  }
};

//初始化系统环境组件
cmps.__env__ = new Component('__env__', null, function () {});
cmps.__env__.state = 2;

var wcExt = {
  /**
   * 初始化组件或者补全组件
   *  
   *  如果找到该组件则保留该组件引用,反之先创建在持有引用
   * 
   * @param {String} id - 组件id
   * @param {Boolean} ctxSync - 是否将id同步成组件的容器
   */
  ctor: function ctor(id, ctxSync) {

    this.cmp = cmps[id] || (cmps[id] = new Component(id));

    if (ctxSync === true || ctxSync === undefined) this.cmp.ctx = '#' + id;

    return this;
  },

  /**
   * 当前组件寄宿在页面的配置
   * 
   * @param {String|Array} [ctx] 当前组件将要寄宿在页面的容器的筛选条件
   */
  at: function at(ctx, options) {
    var self = this;

    if (!self.cmp) return self;

    var cmp = self.cmp;

    if (arguments.length === 1) {
      if (isObject(arguments[0])) {
        options = ctx;
        ctx = null;
      }
    }

    if (!ctx) {
      cmp.ctx = '#' + cmp.id;
      cmp.opts = options;
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
      var len = ctx.length - 1;

      cmp.ctx = ctx[len];

      for (; len--;) {

        self.copy = self.copy || [];

        var newId = cmp.id + '_v' + len;

        self.copy.push(cmps[newId] = new Component(newId, options || cmp.options, cmp.factory));
      }
    } else {
      cmp.ctx = ctx;
      options && (cmp.opts = cmp.opts ? Object.assign(cmp.opts, options) : options);
    }

    return self;
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
  sub: function sub(cmpID, cmpEvts, receiverEvt) {

    if (!isArray(cmpEvts)) cmpEvts = [cmpEvts];

    var tracer = void 0,
        len = cmpEvts.length;

    for (; len--;) {

      tracer = EventTracer.get(Component.nameFn(cmpID, cmpEvts[len]));

      if (tracer) {
        tracer.addSub(receiverEvt, this.cmp.id);
        if (this.copy && this.copy.length) {
          for (var l2 = this.copy.length; l2--;) {
            tracer.addSub(receiverEvt, this.copy[l2].id);
          }
        }
        continue;
      }

      tracer = new EventTracer(cmpEvts[len], cmpID);

      tracer.addSub(this.cmp.id, receiverEvt);

      if (this.copy && this.copy.length) {
        for (var _l = this.copy.length; _l--;) {
          tracer.addSub(this.copy[_l].id, receiverEvt);
        }
      }

      EventTracer.set(tracer);
    }

    return this;
  }
};

wcExt.ctor.prototype = wcExt;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * wc 全局对象
 * 
 * @param {String} id - 组件id
 * @param {Boolean} ctxSync - 是否将id同步成组件的容器
 */
var wc = window.wc = function wc(id, ctxSync) {
  return wcExt.ctor(id, ctxSync);
};

/**
 * 兼容 commonjs、 amd、cmd模式
 */
if (typeof define === 'function') {
  if (define.amd) {
    define('wc', [], function () {
      return wc;
    });
  } else if (define.cmd) {
    define(function (require, exports, module) {
      module.exports = wc;
    });
  }
} else if (typeof module !== 'undefined' && (typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) === 'object') {
  module.exports = wc;
}

/**
 * wc 当前版本号
 */
wc.version = '0.0.1';

/**
 * 定义wc组件
 * 
 * @param {String} id - 组件自定义唯一标识名称
 * @param {Object} [opts] - 组件的可选配置(解决组件的自适应宿主性)
 * @param {Function} factory - 组件的构造工厂
 */
wc.define = function (id, opts, factory) {
  if (!id) return;
  var cmp = cmps[id];

  if (!factory && isFunction(opts)) {
    factory = opts;
    opts = null;
  }

  if (!cmp) {
    cmp = cmps[id] = new Component(id, opts, factory);
  } else {
    //合并opts和更新factory
    cmp.fac = factory;
    opts && (cmp.opts = cmp.opts ? Object.assign(cmp.opts, opts) : opts);
  }
  cmp.state = 2;
};

/**
 * wc针对当前页面的组件消息配置
 * 
 * @param {Object} options - 针对当前页面的数据配置项
 * @param {Boolean} [options.debug=false] - 是否开启调试模式
 * @param {Number} [options.threshold=0] - 页面滚动/resize时执行按需加载组件的阈值
 * @param {Object} [options.combo] - 按需异步加载组件时候的请求地址(建议是具有combo特性的服务端请求地址)
 */
wc.config = function (options) {

  if (options.debug) {
    wc.data = {
      cmps: cmps,
      waitingSubscribers: waitingSubscribers,
      events: events
    };
  }

  conf.threshold = options.threshold || 0;

  conf.combo = options.combo;
};

/**
 * wc扩展操作定义/覆盖
 * 
 * @param {String} name - 扩展操作的名称
 * @param {Function} handler - 扩展操作的处理器
 */
wc.fn = function (name, handler) {

  if (!allowFns.includes(name)) return this;

  var proto = Component.prototype;

  if (isFunction(handler)) {
    proto[name] = function () {
      return handler.apply(this, arguments);
    };
  } else if (isObject(handler)) {

    var oldHandler = proto[oldHandler];

    proto[name] = oldHandler ? Object.assign(oldHandler, handler) : handler;
  }
};

/**
 * 函数节流
 * @param  {Function} func    被节流包装的实际调用函数
 * @param  {Number} wait    函数节流的执行时间间隔
 * @param  {Object} options 可选参数
 * @return {[type]}         [description]
 */
function throttle(func, wait, options) {

  var context = void 0,
      args = void 0,
      result = void 0,
      timeout = null,
      previous = 0;

  if (!options) options = {};

  var later = function later() {
    previous = options.leading === false ? 0 : new Date().getTime();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null;
  };

  return function () {
    var now = new Date().getTime();
    if (!previous && options.leading === false) previous = now;
    var remaining = wait - (now - previous);
    context = this;
    args = arguments;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };
}

var util = Object.freeze({
	throttle: throttle
});

var tpl = (function (tplname, context, isRaw) {
  return window[isRaw ? 'renderString' : 'render'](tplname, context);
});

var jQ = window.$ || window.jQuery;

/**
 * DOM元素筛选操作---基于jQuery
 * 
 * @export
 * @param {String} selector - 筛选器(类似jquery的selector) 
 * @returns jQuery对象
 */
function $$1(selector) {

  var ctx = this.ctx || '#' + this.id;

  if (!ctx) return jQ(selector);

  if (!selector) return jQ(ctx);

  if (selector.nodeType) return jQ(selector);

  return jQ(ctx + ' ' + selector);
}

/**
 * 判断当前元素是否在当前可视区域内
 *
 * @param {any} selector 元素选择器(只取一个)
 * @param {any} threshold 偏移阈值
 * @returns
 */
function isInVisualArea(selector, threshold) {

  threshold = threshold || 0;

  var target = $$1(selector);

  if (!target) return false;

  var offset = target.offset(),
      tg_left_begin = offset.left - threshold,
      tg_top_begin = offset.top - threshold,
      tg_left_end = target.width() + tg_left_begin + threshold,
      tg_top_end = target.height() + tg_top_begin + threshold;

  var $win = $$1(window),
      win_left_begin = $win.scrollLeft(),
      win_top_begin = $win.scrollTop(),
      win_left_end = win_left_begin + $win.width(),
      win_top_end = win_top_begin + $win.height();

  return !(tg_left_begin > win_left_end || win_left_begin > tg_left_end || tg_top_begin > win_top_end || win_top_begin > tg_top_end);
}

var doc = document;
var head = doc.head || doc.getElementsByTagName('head')[0] || doc.documentElement;
var baseElement = head.getElementsByTagName('base')[0];

// `onload` event is not supported in WebKit < 535.23 and Firefox < 9.0
// ref:
//  - https://bugs.webkit.org/show_activity.cgi?id=38995
//  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
//  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
var isOldWebKit = +navigator.userAgent.replace(/.*(?:AppleWebKit|AndroidWebKit)\/?(\d+).*/i, '$1') < 536;

// let isWebWorker = typeof window === 'undefined' && typeof importScripts !== 'undefined' && (typeof importScripts === 'function')

/**
 * 下载js或css（动态添加script、link的方式）
 *
 * @param {any} settings
 * @param {any} cb
 */
function loadJSCSS(settings, cb) {

  var url = void 0;

  if (typeof settings === 'string') {
    url = settings;
    settings = {
      callback: cb
    };
  } else {
    url = settings.url;
  }

  var isCSS = url && /\.css(?:\?|$)/i.test(url);

  var node = document.createElement(isCSS ? 'link' : 'script');

  node.charset = 'utf-8';
  node.crossOrigin = true;

  if (isCSS) {
    node.rel = 'stylesheet';
  } else {
    node.async = true;
    node.type = settings.type || 'text/javascript';
  }

  addOnload(node, settings.callback, url || 'inline-script', isCSS);

  isCSS ? node.href = url : node.src = url;

  // ref: #185 & http://dev.jquery.com/ticket/2709
  baseElement ? head.insertBefore(node, baseElement) : head.appendChild(node

  // 借鉴seajs
  );function addOnload(nodeP, callback, uri, isCSS) {
    var supportOnload = 'onload' in nodeP;

    // for Old WebKit and Old Firefox
    if (isCSS && (isOldWebKit || !supportOnload)) {
      setTimeout(function () {
        pollCss(nodeP, callback);
      }, 1 // Begin after nodeP insertion
      );return;
    }

    if (supportOnload) {
      nodeP.onload = onload;
      nodeP.onerror = function () {
        onload({
          uri: uri,
          node: nodeP
        });
      };
    } else {
      nodeP.onreadystatechange = function () {
        if (/loaded|complete/.test(nodeP.readyState)) {
          onload();
        }
      };
    }

    function onload(error) {
      // Ensure only run once and handle memory leak in IE
      nodeP.onload = nodeP.onerror = nodeP.onreadystatechange = null;
      // Dereference the nodeP
      nodeP = null;
      callback && callback(error);
    }
  }

  function pollCss(nodeP, callback) {
    var sheet = nodeP.sheet,
        isLoaded = void 0;

    // for WebKit < 536
    if (isOldWebKit) {
      if (sheet) isLoaded = true; // for Firefox < 9.0
    } else if (sheet) {
      try {
        if (sheet.cssRules) isLoaded = true;
      } catch (ex) {
        // The value of `ex.name` is changed from "NS_ERROR_DOM_SECURITY_ERR"
        // to "SecurityError" since Firefox 13.0. But Firefox is less than 9.0
        // in here, So it is ok to just rely on "NS_ERROR_DOM_SECURITY_ERR"
        if (ex.name === 'NS_ERROR_DOM_SECURITY_ERR') {
          isLoaded = true;
        }
      }
    }

    setTimeout(function () {
      if (isLoaded) {
        // Place callback here to give time for style rendering
        callback && callback();
      } else {
        pollCss(nodeP, callback);
      }
    }, 20);
  }
}

var jQ$1 = window.$;

function Request(url, options) {

  //判断url是否是js请求或css请求
  var lastIndex = url.lastIndexOf('.');
  var ext = url.substring(lastIndex + 1, url.length);
  var promise = void 0;
  if (ext === 'css' || ext === 'js') {
    var def = jQ$1.Deferred();
    loadJSCSS(url, function (err) {
      return err ? def.reject(err) : def.resolve('ok');
    });
    promise = def.promise();
    promise.catch = promise.error || promise.fail;
    return promise;
  }

  var newOpts = jQ$1.extend({
    url: url
  }, options);

  promise = $.ajax(newOpts);

  promise.catch = promise.error || promise.fail;

  return promise;
}

wc.fn('util', util);

wc.fn('$', $$1);

wc.fn('tpl', tpl);

wc.fn('http', Request);

function lazyloadCmp() {

  var cmp = void 0,
      loadedcmp = void 0,
      waitingFetchCMPs = [];

  if (remainCmps && remainCmps.length) {

    for (var l = remainCmps.length; l--;) {

      cmp = cmps[remainCmps[l]];

      if (cmp.state === 2) {
        Component.load(cmp);
        remainCmps.splice(l, 1);
        loadedcmp = true;
        continue;
      } else if (cmp.state === 0 && cmp.ctx && cmp.http && isInVisualArea && isInVisualArea(cmp.ctx)) {
        waitingFetchCMPs.push(cmp.id);
      }
      loadedcmp = false;
    }
  } else {
    for (var cmpid in cmps) {
      if ('__env__' === cmpid) continue;
      cmp = cmps[cmpid];
      switch (cmp.state) {
        case 0:
          //unftech
          if (cmp.state === 0 && cmp.ctx && cmp.http && isInVisualArea && isInVisualArea(cmp.ctx)) waitingFetchCMPs.push(cmp.id);
          break;
        case 1:
          //fetching
          remainCmps.push(cmp.id);
          loadedcmp = false;
          break;
        case 2:
          //fetched
          Component.load(cmp);
        case 3:
        default:
          //loaded
          loadedcmp = true;
          break;
      }
    }
  }

  if (!waitingFetchCMPs.length) return loadedcmp;

  var len = waitingFetchCMPs.length;

  if (conf.combo) {

    var url = conf.combo(waitingFetchCMPs, 'js');

    for (; len--;) {
      cmps[waitingFetchCMPs[len]].state = 1;
    }len = waitingFetchCMPs.length;

    Component.prototype.http(url).then(function () {
      for (; len--;) {
        Component.load(cmps[waitingFetchCMPs[len]]);
      }
    }).catch(function () {
      for (; len--;) {
        cmps[waitingFetchCMPs[len]].state = 4;
      } //失败 error
    });

    url = conf.combo(waitingFetchCMPs, 'css');

    Component.prototype.http(url).catch(function (err) {
      return console.log(err);
    });
  }

  return loadedcmp;
}

/**
 * 组件适应宿主的处理
 */

jQ(function () {
  lazyloadCmp() && cmps.__env__.pub('ready');
});

var $doc = jQ(document);

var $w = jQ(window).on('load', function () {
  return lazyloadCmp() && cmps.__env__.pub('onLoad');
}).on('resize', throttle(function () {
  return lazyloadCmp() && cmps.__env__.pub('onResize', [$w.width(), $w.height(), $doc.width(), $doc.height()]);
}, 300)).on('scroll', throttle(function () {
  return lazyloadCmp() && cmps.__env__.pub('onScroll', [$w.scrollTop(), $w.scrollLeft()]);
}, 300)).on('beforeunload', function (e) {
  return cmps.__env__.pub('beforeLeave', e);
});

}());

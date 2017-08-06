(function () {
'use strict';

/**
 * 所有等待被唤醒的事件键值集合
 *
 *  数据结构要求:
 *  1. 能够实现订阅方所属组件id的快速定位
 *  2. 能够包含到从发布方到订阅方的过程信息
 * format:
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
 * 浏览器宿主允许被订阅的主题
 * @type {Array}
 */
var browserActions = ['ready', 'loaded', 'scroll', 'resize'];

/**
 * 可以被允许注入的
 * @type {Array}
 */
var allowWeblize = ['$', 'http', 'tpl', 'anim', 'cache'];

/**
 * 框架的配置信息
 * @type {Object}
 */
var conf = {};

function isType(type) {
    return function (obj) {
        return Object.prototype.toString.call(obj) === '[object ' + type + ']';
    };
}

var isArray = Array.isArray || isType('Array');

var isFunction = isType('Function');

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
     * @param {any} eventName 事件名称
     * @param {any} handler 事件处理函数
     * @param {any} isOnce 是否是作为只消费一次的事件
     */
    on: function on(eventName, handler, isOnce) {

        if (!eventName || !handler) return this;

        var _cb2 = handler;

        if (isOnce) {

            var fire = false,
                _cb = handler;

            _cb2 = function cb() {
                ebus.off(eventName, _cb2);
                if (!fire) {
                    fire = true;
                    _cb.apply(this, arguments);
                }
            };
        }

        for (var list, l = (eventName = eventName.split(',')).length; l--;) {
            list = events[eventName[l]] || (events[eventName[l]] = []);
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
     * @param {String} eventName 事件名称
     * @param {Function} handler  事件处理函数
     * @memberof ebus
     * @returns {Object} ebus
     */
    off: function off(eventName, handler) {

        // Remove all events
        if (!(eventName || handler)) {
            events = {};
            return this;
        }

        var list = events[eventName],
            l = void 0;

        if (list && (l = list.length)) {
            if (!handler) {
                // Remove all events
                delete events[eventName];
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
     * @param {String|Array} eventName 事件名称
     * @param {any} data 发出数据
     * @param {Function} tracerRecorder 事件发布订阅过程的站点记录函数
     */
    emit: function emit(eventName, data, tracerRecorder) {

        if (!eventName) return;

        if (!isArray(data)) data = [data];

        var list = void 0,
            l2 = void 0;

        if (!isArray(eventName)) {

            list = events[eventName];

            if (!list || !(l2 = list.length)) return;

            tracerRecorder && tracerRecorder.sub(eventName, l2);

            list = list.slice();

            for (; l2--;) {

                tracerRecorder && tracerRecorder.hndIdx(l2);

                list[l2].apply(null, data);
            }

            return;
        }
        for (var i = 0, l = eventName.length; i < l; i++) {

            list = events[eventName[i]];

            if (!list || !(l2 = list.length)) continue;

            tracerRecorder && tracerRecorder.sub(eventName[i], l2);

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
 * @param {any} publisherFullEvtName 发布方事件
 * @param {any} cmp 发布方所属组件
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
     * 新增当前发布订阅事件追踪的订阅方
     *
     * @param {String} cmpid 订阅方组件id
     * @param {String} eventName 订阅方的事件名称
     */
    addSub: function addSub(cmpid, eventName) {
        var evts = this.subs[cmpid];
        if (!evts) {
            this.subs[cmpid] = [eventName];
        } else {
            evts.push(eventName);
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

var EVENT_SPERATOR = '_';

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
function Component(id, options, factory) {

    this.id = id;

    this.opt = options || {};

    this.fac = factory;

    this.state = 0; //unfetched
}

/**
 * 组件完整事件名称命名方法
 */
Component.nameFn = function (cmpid, eventName) {
    return cmpid + EVENT_SPERATOR + eventName;
};

Component.prototype = {

    constructor: Component,

    /**
     * 发布事件
     *
     * @param {String} eventName 待发布的事件名称
     * @param {Object|Array} 当前发布事件携带的数据
     * @param {Function} 用于接收订阅方反馈数据的回调 *Optional*
     */
    pub: function pub(eventName, data, cb) {

        var fullEventName = Component.nameFn(this.id, eventName

        //寻找此主题的订阅方
        );var tracer = EventTracer.get(fullEventName //已经知道当前的发出方信息

        );if (!tracer) return this;

        var subscribersKV = tracer.subs,
            subCMPID = void 0,
            subEvtArr = void 0,
            subEvtArrLen = void 0,
            subCMP = void 0,
            waitingSubEvtMapKV = void 0,
            waitingSubEvtMapItemArr = void 0,
            totalSubLen = 0;

        if (!subscribersKV) return this;

        //追踪过程的当前站点信息记录
        var tracerRecorder = tracer.record(fullEventName, this.id);

        var waitingFetchCMPs = [];

        for (subCMPID in subscribersKV) {

            subEvtArr = subscribersKV[subCMPID];

            if (!subEvtArr) continue;
            if (!subEvtArr.length) {
                delete subscribersKV[subCMPID];
                continue;
            }

            subCMP = cmps[subCMPID];

            if (!subCMP) continue;

            subEvtArrLen = subEvtArr.length;

            totalSubLen += subEvtArrLen;

            //如果事件订阅方组件的状态是unfetch(0)或者fetcing(1)的情况下,要将事件推送到等待缓冲中
            if (subCMP.state === 0 || subCMP.state === 1) {
                if (subCMP.state === 0) {
                    waitingFetchCMPs.push(subCMPID);
                }

                waitingSubEvtMapKV = waitingSubscribers[subCMPID];

                if (!waitingSubEvtMapKV) continue;

                for (; subEvtArrLen--;) {
                    waitingSubEvtMapItemArr = waitingSubEvtMapKV[subEvtArr[subEvtArrLen]];

                    if (!waitingSubEvtMapItemArr) {
                        waitingSubEvtMapKV[subEvtArr[subEvtArrLen]] = [{
                            cmp: this.id,
                            evt: eventName,
                            data: data
                        }];
                    } else if (!waitingSubEvtMapItemArr.length) {
                        waitingSubEvtMapItemArr.push({
                            cmp: this.id,
                            evt: eventName,
                            data: data
                        });
                    } else {
                        var isRepeat = false;

                        //判断是否出现重复
                        for (var waitingSubEvtMapItemArrLen = waitingSubEvtMapItemArr.length; waitingSubEvtMapItemArrLen--;) {

                            var mapItem = waitingSubEvtMapItemArr[waitingSubEvtMapItemArrLen];

                            if (mapItem.cmp === this.id && mapItem.evt === eventName) {
                                mapItem.data = data;
                                isRepeat = true;
                            }
                        }

                        if (!isRepeat) {
                            waitingSubEvtMapItemArr.push({
                                cmp: this.id,
                                evt: eventName,
                                data: data
                            });
                        }
                    }
                }

                if (waitingFetchCMPs && waitingFetchCMPs.length && this.http) {
                    (function () {
                        var url = void 0,
                            len = waitingFetchCMPs.length;
                        if (conf.combo) {
                            if (conf.combo.js) {
                                url = conf.combo.js(waitingFetchCMPs, conf.root);
                                for (; len--;) {
                                    cmps[waitingFetchCMPs[len]].state = 1;
                                }Component.prototype.http(url).then(function () {
                                    for (len = waitingFetchCMPs.length; len--;) {
                                        Component.load(cmps[waitingFetchCMPs[len]]);
                                    }
                                }).catch(function () {
                                    for (len = waitingFetchCMPs.length; len--;) {
                                        cmps[waitingFetchCMPs[len]].state = 1;
                                    }
                                });
                            }
                            if (conf.combo.css) {
                                url = conf.combo.css(waitingFetchCMPs, conf.root);
                                Component.prototype.http(url);
                            }
                            if (conf.combo.tpl) {
                                url = conf.combo.tpl(waitingFetchCMPs, conf.root);
                                Component.prototype.http(url);
                            }
                        } else {
                            var _loop = function _loop(_cmp) {
                                url = conf.root + waitingFetchCMPs[len] + '.js';
                                _cmp = cmps[waitingFetchCMPs[len]];
                                _cmp.state = 1;
                                _cmp.http(url).then(function () {
                                    return Component.load(_cmp);
                                }).catch(function () {
                                    _cmp.state = 0;
                                });
                                cmp = _cmp;
                            };

                            for (var cmp; len--;) {
                                _loop(cmp);
                            }
                        }
                    })();
                }

                continue;
            }

            for (; subEvtArrLen--;) {
                ebus.emit(Component.nameFn(subCMPID, subEvtArr[subEvtArrLen]), data, tracerRecorder);
            }
        }

        tracer.sublen = totalSubLen;
        tracer.cb = cb;
    },

    /**
     * 定义一个对外事件
     *  用于作为订阅方
     *
     * @param {String} 事件名称
     * @param {Function} 事件处理函数
     */
    out: function out(eventName, handler) {
        ebus.on(Component.nameFn(this.id, eventName), handler.bind(Component.eventRicher));
        return this;
    },

    /**
     * 适配浏览器的生命周期和操作
     */
    env: function env(eventName, handler) {

        if (browserActions.includes(eventName)) {

            var fullEvtName = Component.nameFn(this.id, eventName);

            ebus.on(fullEvtName, handler.bind(Component.eventRicher), eventName === 'ready' || eventName === 'loaded'

            //注册组件__env__与此组件的关联关系

            );var tracer = EventTracer.get(Component.nameFn('__env__', eventName));
            if (!tracer) {
                EventTracer.set(tracer = new EventTracer(eventName, '__env__'));
            }

            tracer.addSub(this.id, eventName);
        }

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

/**
wc('id')
    .opts({})
    .at('ctx')
    .sub('cmp1',['text1','text2'],'out1')
    .sub('cmp1',['text4','text3'],'out2')
    .sub('cmp2',['text4','text3'],'out2')
    .sub('cmp2',['text4','text3'],'out2')
 */
var wc = window.wc = function wc(id) {
    return new wcExt.ctor(id);
};

// The current version of wc being used
wc.version = '0.0.1';

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
wc.config = function (configMeta) {

    if (configMeta.debug) {
        wc.data = {
            cmps: cmps,
            waitingSubscribers: waitingSubscribers,
            events: events
        };
    }
    conf.threshold = configMeta.threshold || 0;
    conf.root = configMeta.root;
    conf.combo = configMeta.combo;
};

/**
 * 组件定义
 *
 * @param {String} id 组件id
 * @param {Object} options 组将对外配置项
 * @param {Function} factory 组件工厂
 *
 */
wc.define = function (id, options, factory) {

    if (!id) return;

    var cmp = cmps[id];

    if (!cmp) {

        cmp = cmps[id] = new Component(id, options, factory);
    } else {

        //合并opts和更新factory
        cmp.fac = factory;

        options && (cmp.opts = cmp.opts ? Object.assign(cmp.opts, options) : options);
    }

    cmp.state = 2;
};

/**
 * 加载组件基于宿主环境的情况下
 * 
 * @param {String} action 浏览器操作名称
 * @param {any} data 传输数据
 * @param {Function} isInVisiableFn 是否在可视区域内的方法
 */
wc.load = function (action, data, isInVisiableFn) {

    if (!action) return;

    if (!browserActions.includes(action)) return;

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
            } else if (cmp.state === 0 && cmp.ctx && cmp.http && isInVisiableFn && isInVisiableFn(cmp.ctx)) {
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
                    if (cmp.state === 0 && cmp.ctx && cmp.http && isInVisiableFn && isInVisiableFn(cmp.ctx)) waitingFetchCMPs.push(cmp.id);
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

    if (waitingFetchCMPs && waitingFetchCMPs.length && Component.prototype.http) {
        var url = void 0,
            len = waitingFetchCMPs.length;
        if (conf.combo) {
            if (conf.combo.js) {
                url = conf.combo.js(waitingFetchCMPs, conf.root);
                for (; len--;) {
                    cmps[waitingFetchCMPs[len]].state = 1;
                }Component.prototype.http(url).then(function () {
                    for (len = waitingFetchCMPs.length; len--;) {
                        Component.load(cmps[waitingFetchCMPs[len]]);
                    }
                }).catch(function () {
                    for (len = waitingFetchCMPs.length; len--;) {
                        cmps[waitingFetchCMPs[len]].state = 1;
                    }
                });
            }
            if (conf.combo.css) {
                url = conf.combo.css(waitingFetchCMPs, conf.root);
                Component.prototype.http(url);
            }
            if (conf.combo.tpl) {
                url = conf.combo.tpl(waitingFetchCMPs, conf.root);
                Component.prototype.http(url);
            }
        } else {
            for (; len--;) {
                url = conf.root + waitingFetchCMPs[len] + '.js';
                cmp = cmps[waitingFetchCMPs[len]];
                cmp.state = 1;
                cmp.http(url).then(function () {
                    return Component.load(cmp);
                }).catch(function () {
                    cmp.state = 0;
                });
            }
        }
    }
    loadedcmp && cmps.__env__.pub(action, data //系统组件主动发布事件
    );
};

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
wc.web = function (usage, handler) {
    if (allowWeblize.includes(usage) && isFunction(handler)) {
        Component.prototype[usage] = function () {
            return handler.apply(this, arguments);
        };
    }
    return wc;
};

var wcExt = wc.prototype = {
    ctor: function ctor(id) {
        var cmp = cmps[id];

        if (!cmp) {
            cmp = cmps[id] = new Component(id);
            cmp.state = 0;
        }

        this.cmp = cmp;

        return this;
    },
    /**
     * 当前坐落在哪个容器上
     */
    at: function at(ctx, options) {
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
                var len = ctx.length - 1;
                this.cmp.ctx = ctx[len];

                for (; len--;) {

                    this.copy = this.copy || [];

                    var newId = this.cmp.id + '_v' + len;

                    this.copy.push(cmps[newId] = new Component(newId, options || this.cmp.options, this.cmp.factory));
                }
            } else {
                this.cmp.ctx = ctx;
            }
        }

        return this;
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
    sub: function sub(publisherCMPID, publisherEvents, subscriberEventName) {

        if (!isArray(publisherEvents)) publisherEvents = [publisherEvents];

        var tracer = void 0,
            len = publisherEvents.length;

        for (; len--;) {

            tracer = EventTracer.get(Component.nameFn(publisherCMPID, publisherEvents[len]));

            if (tracer) {
                tracer.addSub(subscriberEventName, this.cmp.id);
                if (this.copy && this.copy.length) {
                    for (var l2 = this.copy.length; l2--;) {
                        tracer.addSub(subscriberEventName, this.copy[l2].id);
                    }
                }
                continue;
            }

            tracer = new EventTracer(publisherEvents[len], publisherCMPID);

            tracer.addSub(this.cmp.id, subscriberEventName);

            if (this.copy && this.copy.length) {
                for (var _l = this.copy.length; _l--;) {
                    tracer.addSub(this.copy[_l].id, subscriberEventName);
                }
            }

            EventTracer.set(tracer);
        }

        return this;
    }
};

wcExt.ctor.prototype = wcExt;

}());

(function () {
'use strict';

// Must be writable: true, enumerable: false, configurable: true
Object.defineProperty(Object, 'assign', {
    value: function assign(target, varArgs) {
        // .length of function is 2
        'use strict';

        if (target == null) {
            // TypeError if undefined or null
            throw new TypeError('Cannot convert undefined or null to object');
        }

        var to = Object(target);

        for (var index = 1, l = arguments.length; index < l; index++) {

            var nextSource = arguments[index];

            if (nextSource != null) {
                // Skip over if undefined or null
                for (var nextKey in nextSource) {
                    // Avoid bugs when hasOwnProperty is shadowed
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    },
    writable: true,
    configurable: true
});

Array.prototype.includes = function includes(target) {
    for (var l = this.length; l--;) {
        if (this[l] === target) return true;
    }
    return false;
};

var slice = Array.prototype.slice;
var NOP = function NOP() {};

Function.prototype.bind = function bind(scope) {

    var fn = this;

    if (typeof fn !== 'function') {
        // closest thing possible to the ECMAScript 5
        // internal IsCallable function
        throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

    var aArgs = slice.call(arguments, 1),
        fToBind = fn,
        fBound = function fBound() {
        return fToBind.apply(fn instanceof NOP ? fn : scope, aArgs.concat(slice.call(arguments)));
    };

    // Function.prototype doesn't have a prototype property
    if (fn.prototype) NOP.prototype = fn.prototype;

    fBound.prototype = new NOP();

    return fBound;
};

}());

(function () {
'use strict';

/**
 * 判断当前元素是否在当前可视区域内
 *
 * @param {any} selector 元素选择器(只取一个)
 * @param {any} threshold 偏移阈值
 * @returns
 */
function isInVisualArea(selector, threshold) {

    threshold = threshold || 0;

    var target = $(selector),
        offset = target.offset(),
        tg_left_begin = offset.left - threshold,
        tg_top_begin = offset.top - threshold,
        tg_left_end = target.width() + tg_left_begin + threshold,
        tg_top_end = target.height() + tg_top_begin + threshold;

    var $win = $w || $(window),
        win_left_begin = $win.scrollLeft(),
        win_top_begin = $win.scrollTop(),
        win_left_end = win_left_begin + $win.width(),
        win_top_end = win_top_begin + $win.height();

    return !(tg_left_begin > win_left_end || win_left_begin > tg_left_end || tg_top_begin > win_top_end || win_top_begin > tg_top_end);
}

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

wc.web('$', window.$);

var $doc = $(document).ready(function () {
    return wc.load('ready', null, isInVisualArea);
});

var $w = $(window).on('load', function () {
    return wc.load('loaded', null, isInVisualArea);
}).on('resize', throttle(function () {
    return wc.load('resize', [$w.width(), $w.height(), $doc.width(), $doc.height()], isInVisualArea);
}, 300)).on('scroll', throttle(function () {
    return wc.load('scroll', [$w.scrollTop(), $w.scrollLeft()], isInVisualArea);
}, 300));

}());

(function () {
'use strict';

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
                onload({ uri: uri, node: nodeP });
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

var jQ = window.$;

wc.web('http', function Request(url, options) {

    //判断url是否是js请求或css请求
    var lastIndex = url.lastIndexOf('.');

    var ext = url.substring(lastIndex + 1, url.length);
    var promise = void 0;
    if (ext === 'css' || ext === 'js') {
        var def = jQ.Deferred();
        loadJSCSS(url, function (err, data) {
            return err ? def.reject(err) : def.resolve('ok');
        });
        promise = def.promise();
        promise.catch = promise.error || promise.fail;
        return promise;
    }

    var newOpts = jQ.extend({ url: url }, options);

    promise = $.ajax(newOpts);

    promise.catch = promise.error || promise.fail;

    return promise;
});

}());

(function () {
'use strict';

wc.web('tpl', function (tplname, context, isRaw) {
  return nunjucks[isRaw ? 'renderString' : 'render'](tplname, context);
});

}());

(function () {
'use strict';

/**
 * 存储框架所需的基础变量
 */

/**
 * 允许的自定义注入对象的归类
 * @type {Array}
 */
var allowUsage = ['$', 'http', 'tpl', 'util', 'anim', 'cache', 'res'];

/**
 * 浏览器宿主允许被订阅的主题
 * @type {Array}
 */
var allowBrowserTopics = ['ready', 'loaded', 'scroll', 'resize'];

/**
 * 组件状态
 * @type {Object}
 */
var STATE = {
  unfetch: 0,
  fetching: 1,
  fetched: 2,
  loaded: 3

  /**
   * 框架的组件集合
   * @type {[type]}
   */
};var cmps = {};

/**
 * 剩余的还未fetch的组件集合
 */
var remain_cmps = {};

/**
 * 所有主题的存储
 * @type {Object}
 */
var topics = {};

/**
 * 等待被呼叫的主题
 */
var waiting_call = {};

/**
 * 当前主题发布跟踪对象
 */
var cur_topic_tracing = {};

/**
 * 框架的配置信息
 * @type {Object}
 */
var conf = {};

/**
 * 框架的注入对象存储地
 * @type {Object}
 */
var injectors = {};

/**
 * 异常枚举
 * @type {Object}
 */
var ERRFLAG = {
  'E101': '组件的id不能为空',
  'E102': '此次调用的恢复过程受阻,由于接收不到恢复信号',
  'E103': '注入器没有对应的具体实现,请使用wc.inject()来填充此注入器',
  'W101': '组件对外自定义的注入器不包含在($、http、tpl、util、anim)中',
  'W102': 'wc.inject()缺少必备参数',
  'W103': '调用wc.inject()时,如未指定replace=true的条件下,injectKV只能为键值对类型'
};

/**
 * 操纵主题的控制中心
 *
 *  1. 订阅主题
 *  2. 取消订阅主题
 *  3. 单向发布主题
 *  4. 发布主题并接受订阅者反馈
 */
function TopicCenter() {}

/**
 * 注册主题到处理中心
 * @return {[type]} [description]
 */
TopicCenter.on = function (name, fn, isOnce) {
    var self = this;

    if (!name || !fn) return self;

    var _cb2 = fn;

    if (isOnce) {

        var fire = false,
            _cb = fn;

        _cb2 = function cb() {
            TopicCenter.off(name, _cb2);
            if (!fire) {
                fire = true;
                _cb.apply(this, arguments);
            }
        };
    }

    for (var list, l = (name = name.split(',')).length; l--;) {
        list = topics[name[l]];
        if (list && list.length) {
            list.push(_cb2);
        } else {
            topics[name[l]] = [_cb2];
        }
    }

    return this;
};

/**
 * 卸载主题
 * @param  {[type]}   name [description]
 * @param  {Function} fn        [description]
 * @return {[type]}             [description]
 */
TopicCenter.off = function (name, fn) {
    var self = this;

    // Remove *all* events
    if (!(name || fn)) return self;

    var list = topics[name],
        l = void 0;

    if (list && (l = list.length)) {
        if (fn) {
            for (; l--;) {
                if (list[l] === fn) list.splice(l, 1);
            }
        } else {
            delete topics[name];
        }
    }

    return self;
};

TopicCenter.emit = function (topicNames, data) {

    var list = void 0,
        l2 = void 0,
        l = topicNames.length;

    for (var i = 0; i < l; i++) {

        cur_topic_tracing.sub_topic_idx = i;

        list = topics[topicNames[i]];

        if (!list || !list.length) continue;

        list = list.slice();

        for (l2 = list.length; l2--;) {

            cur_topic_tracing.sub__topic_fn_idx = l2;

            list[l2].apply(null, data);
        }
    }
};

function isType(type) {
    return function (obj) {
        return Object.prototype.toString.call(obj) === "[object " + type + "]";
    };
}

var isObject = isType("Object");
var isString = isType("String");
var extend = Object.assign;
var print = function print(msg) {
    return console.warn(msg);
};

if (![].includes) {
    Array.prototype.includes = function (item) {
        for (var l = this.length; l--;) {
            if (this[l] === item) return true;
        }
        return false;
    };
}

var slice = Array.prototype.slice;
var fNOP = function fNOP() {};

Function.prototype.bind = Function.prototype.bind || function (oThis) {
    if (typeof this !== 'function') {
        // closest thing possible to the ECMAScript 5
        // internal IsCallable function
        throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

    var aArgs = slice.call(arguments, 1),
        fToBind = this,
        fBound = function fBound() {
        return fToBind.apply(this instanceof fNOP ? this : oThis, aArgs.concat(slice.call(arguments)));
    };

    // Function.prototype doesn't have a prototype property
    if (this.prototype) fNOP.prototype = this.prototype;

    fBound.prototype = new fNOP();
    return fBound;
};

var SIGNALSEPRATOR = '::';

var TOPICSEPRATOR = '_';

/**
 * 组件定义库
 */
function CMP(id, opts, factory) {
    this.id = id;
    this.opts = opts;
    this.fac = factory;
    this.state = STATE.unfetch;
}

CMP.nameFn = function (cmpid, topic) {
    return cmpid + TOPICSEPRATOR + topic;
};

/**
 * 装载组件
 * @param  {Object} cmpIns [description]
 */
CMP.load = function (cmpIns) {

    var factory = cmpIns.fac;

    factory.call(cmpIns);

    cmpIns.state = STATE.loaded;

    delete cmpIns.fac;

    //查看waiting_topics中是否存在当前组件的等待被呼叫的主题

    var item = waiting_call[cmpIns.id];
    if (!item) return;

    var deps = cmps[item.pub].deps;
    if (!deps) return;

    var subscriber_kv_arr = deps[item.pub];

    if (!subscriber_kv_arr || !subscriber_kv_arr.length || !subscriber_kv_arr.__cb) return undefined;

    cur_topic_tracing.pub = item.pub;
    cur_topic_tracing.time = item.time;

    var real_topics = subscriber_kv_arr[cur_topic_tracing.sub_idx = idx];

    TopicCenter.emit(CMP.nameFn(cmpIns.id, real_topics.join(',' + cmpIns.id + TOPICSEPRATOR)).split(','), item.data);
};

CMP.util = {
    pause: function pause() {

        if (!cur_topic_tracing.cmp || !cur_topic_tracing.pub) return undefined;

        var deps = cmps[cur_topic_tracing.cmp].deps;

        var subscriber_kv_arr = deps[cur_topic_tracing.pub];

        if (!subscriber_kv_arr || !subscriber_kv_arr.length || !subscriber_kv_arr.__cb) return undefined;

        var sub_idx = cur_topic_tracing.sub_idx;

        var trace = subscriber_kv_arr[sub_idx].__trace = subscriber_kv_arr[sub_idx].__trace || {};

        var time = cur_topic_tracing.time;

        trace[time] = trace[time] || [];

        return cur_topic_tracing.cmp + SIGNALSEPRATOR + cur_topic_tracing.pub + SIGNALSEPRATOR + cur_topic_tracing.sub_idx + SIGNALSEPRATOR + time + SIGNALSEPRATOR + cur_topic_tracing.sub_topic_idx + SIGNALSEPRATOR + cur_topic_tracing.sub_topic_fn_idx;
    },
    /**
     * 恢复当前的主题发布过程
     * @type {Object}
     */
    resume: function resume(data, signal) {

        if (!signal) {
            throw new Error(ERRFLAG.E103);
        }

        //通过这个恢复信号来得到当前的发布订阅消息,publisher = who , subscriber_idx, 格式: publisher__times__subscriberidx__subscriberfnidx
        var arr = signal.split(SIGNALSEPRATOR);

        var cmp = cmps[arr[0]];
        if (!cmp) return;

        var deps = cmp.deps;
        if (!cmp) return;

        var subscriber_kv_arr = deps[arr[1]];

        if (!subscriber_kv_arr || !subscriber_kv_arr.length || !subscriber_kv_arr.__cb) return;

        var cbdatas = subscriber_kv_arr[arr[2]].__trace[arr[3]];

        var sub_fn_cbs = cbdatas[arr[4]] = cbdatas[arr[4]] || [];

        sub_fn_cbs[arr[5]] = data;

        //判断是否已经执行完成
        //获取主题依赖中的具体topics
        var real_topics = deps[arr[1]][arr[2]].topics;

        var real_topic_fns = topics[CMP.nameFn(arr[0], real_topic[arr[4]])];

        if (sub_fn_cbs.length === real_topic_fns) {
            sub_fn_cbs.__fnok = true;
        }

        if (cbdatas.length === real_topics.length) {
            var fnok = true;
            for (var l = cbdatas.length; l--;) {
                if (!('__fnok' in cbdatas[l]) && cbdatas[l].__fnok) {
                    fnok = false;
                    break;
                }
            }
            if (fnok) {
                var cb = subscriber_kv_arr.__cb;

                cb.apply(null, cbdatas);

                delete subscriber_kv_arr[arr[2]].__trace[arr[3]];
            }
        }
    }
};

CMP.prototype = {

    constructor: CMP,
    /**
     * 对外定义输出可被允许触发的关联
     * @param  {String}   name 主题名称
     * @param  {Function} fn   主题响应
     * @return {[type]}        [description]
     */
    out: function out(name, fn) {
        TopicCenter.on(CMP.nameFn(this.id, name), fn.bind(CMP.util));
        return this;
    },
    /**
     * 订阅浏览器宿主主题
     */
    host: function host(name, fn) {
        if (allowBrowserTopics.includes(name)) {
            TopicCenter.on(name, fn.bind(CMP.util), name === 'ready' || name === 'loaded');
        }
        return this;
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
    pub: function pub(name, data, cb) {

        //获取当前待发布主题的订阅方
        var deps = this.deps;

        if (!name || !deps) return this;

        var subscriber_kv_arr = deps[name];

        subscriber_kv_arr.__cb = cb;

        if (!subscriber_kv_arr || !subscriber_kv_arr.length) return this;

        cur_topic_tracing.pub = name;
        cur_topic_tracing.cmp = this.id;

        var cmp = void 0,
            cmpItem = void 0,
            cmpid = void 0,
            subscriber_topics = [],
            tmp = void 0,
            l2 = void 0;
        for (var i = 0, l = subscriber_kv_arr.length; i < l; i++) {

            cmpItem = subscriber_kv_arr[i];

            cmp = cmps[cmpid = cmpItem.id];

            if (!!~cmpItem.topics.indexOf(',')) {
                cmpItem.topics = cmpItem.topics.split(',');
            } else if (isString(cmpItem.topics)) {
                cmpItem.topics = [cmpItem.topics];
            }

            cur_topic_tracing.sub_idx = i;

            cur_topic_tracing.time = new Date().getTime();

            switch (cmp.state) {
                case STATE.fetched:
                    CMP.load(cmp);
                case STATE.loaded:
                    TopicCenter.emit(CMP.nameFn(cmpid, cmpItem.topics.join(',' + cmpid + TOPICSEPRATOR)).split(','), data);
                    break;
                case STATE.fetching:
                case STATE.unfetch:
                    //装载进入waiting_call
                    tmp = waiting_call[cmpItem.id] = waiting_call[cmpItem.id] || {};
                    tmp.idx = i;
                    tmp.pub = this.id;
                    tmp.time = cur_topic_tracing.time;
                    tmp.data = data;
                    break;
            }
        }

        return this;
    }
};

var wc = {};

function loadCombo(needComboCmps, needload) {

    if (!conf.combo) return;

    l = needComboCmps ? needComboCmps.length : 0;

    if (!l) return;

    var cmpids = needComboCmps.join(',');

    for (l = needComboCmps.length; l--;) {
        cmps[needComboCmps[l]].state = STATE.fetching;
    }

    var sperator = conf.combo.sperator || '??';

    if (conf.combo.css_root) {
        injectors.res.fetch(conf.combo.css_root + sperator + cmpids);
    }
    if (conf.combo.js_root) {
        injectors.res.fetch(conf.combo.js_root + sperator + cmpids).then(function () {
            for (l = needComboCmps.length; l--;) {
                if (needload) {
                    CMP.load(cmps[needComboCmps[l]]);
                    remain_cmps[needComboCmps[l]] && delete remain_cmps[needComboCmps[l]];
                } else {
                    cmps[needComboCmps[l]].state = STATE.fetched;
                }
            }
        });
    }
}

/**
 * 定义组件
 * @param  {String} id      组件id
 * @param  {Object-KV} options 组件初始配置项
 * @param  {Function} factory 组件的工厂构造方法
 * @return {WC}         WC对象
 */
wc.cmp = function (id, options, factory) {
    if (!id) return print(ERRFLAG.E101);

    var cmp = cmps[id];

    if (!cmp) {
        cmp = cmps[id] = new CMP(id, options, factory);
    } else {
        //合并opts和更新factory
        cmp.fac = factory;
        cmp.opts = extend(cmp.opts, options);
    }

    cmp.state = STATE.fetched;

    return this;
};

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
wc.conf = function (options) {

    for (var usage, _l = allowUsage.length; _l--;) {
        conf[usage = allowUsage[_l]] = !(usage in options) ? true : !!options[usage];
    }

    conf.util = true;

    conf.threshold = options.threshold || 0;

    var item = void 0,
        l = allowUsage.length;
    //如果有则加载,没有的话就执行强制注入
    for (; l--;) {
        item = allowUsage[l];
        conf[item] && Object.defineProperty(CMP.prototype, item, {
            writable: false,
            configurable: false,
            value: injectors[item]
        });
    }

    l = options.cmps.length;

    var cmp = void 0,
        items = void 0,
        l2 = void 0,
        l3 = void 0;

    for (; l--;) {

        item = options.cmps[l];

        cmp = cmps[item.id];

        if (!cmp) {
            //创建一个CMP对象
            cmp = new CMP(item.id, item.opts);
        } else {
            //更新options
            cmp.opts = item.opts ? extend(cmp.opts, item.opts) : cmp.opts;
        }

        cmp.deps = item.deps;

        if (item.nested) {
            required.push(cmp.id);
        } else if (item.ctx) {
            cmp.ctx = item.ctx;
        } else {
            items = item.usage;
            if (items) {
                var _item = void 0;
                for (l2 = items.length; l2--;) {
                    _item = items[l2];
                    if (_item.nested) {
                        required.push(cmp.id);
                    } else if (_item.ctx) {
                        if (!cmp.ctx) {
                            cmp.ctx = _item.ctx;
                            if (_item.opts) {
                                cmp.opts = extend(cmp.opts, _item.opts);
                            }
                        } else if (cmp.ctx === _item.ctx) {
                            if (_item.opts) {
                                cmp.opts = extend(cmp.opts, _item.opts);
                            }
                        } else {
                            var cmpNew = new CMP(cmp.id + _item.ctx, _item.opts, cmp.fac);
                            cmpNew.ctx = _item.ctx;
                            cmpNew.deps = _item.deps;
                            cmps[cmpNew.id] = cmpNew;
                        }
                    }
                }
            }
        }
    }

    conf.combo = options.combo;

    if (options.debug) {
        var data = wc.data = {};
        data.cmps = cmps;
        data.topics = topics;
        data.injectors = injectors;
    }

    return wc;
};

/**
 * 用户自定义替换wc内部的特定用途的对象
 * @param  {String} usage ['http','tpl','$','anim','util']
 * @param  {Function|Object-KV} injectKV 注入对象
 * @param  {Boolean} replace 是否覆盖现有的实现 默认false
 * @return {[type]}       [description]
 */
wc.inject = function (usage, injectKV, replace) {

    if (arguments.length < 2) {
        print(ERRFLAG.W102);
        return this;
    }
    if (replace) {
        injectors[usage] = injectKV;
    } else {
        if (!isObject(injectKV)) {
            print(ERRFLAG.W103);
            return this;
        }

        var oldVal = injectors[usage] || (injectors[usage] = {});

        var _extend = usage === 'util' ? oldVal.extend : injectors.util.extend;

        if (_extend) {
            _extend(oldVal, injectKV);
        } else {
            for (var i in injectKV) {
                oldVal[i] = injectKV;
            }
        }
    }

    return wc;
};

/**
 * 发布主题
 * @param  {String} hostTopic   主题名称(宿主作为发布者的主题: ready、load、scroll、resize)
 * @param  {Object} context 数据
 * @return {wc}         [description]
 */
wc.pub = function (hostTopic, context) {

    //查找当前发布者对应的订阅者,判断他们的状态
    if (!hostTopic) return this;

    if (allowBrowserTopics.includes(hostTopic)) {
        TopicCenter.emit([hostTopic], context);
    }

    return this;
};

/**
 * @param {Boolean} loadmore 是否加载更多,当为true的时候表示要加载剩余组件的概念
 */
wc.load = function (loadmore) {

    var cmp = void 0,
        l = void 0,
        reqids = [];

    var isVisable = injectors.util.isInVisualArea;

    if (loadmore) {
        for (l = remain_cmps.length; l--;) {
            cmp = remain_cmps[l];
            if (!isVisable(cmp.ctx, conf.threshold)) continue;
            reqids.push(cmp.id);
        }
    } else {
        for (var cmpId in cmps) {
            cmp = cmps[cmpId];
            switch (cmp.state) {
                case STATE.fetched:
                    CMP.load(cmp);
                    break;
                case STATE.unfetch:
                    isVisable(cmp.ctx, conf.threshold) ? reqids.push(cmpId) : remain_cmps.push(cmpId);
                    break;
            }
        }
    }
    reqids.length && loadCombo(reqids, true);
};

window.wc = wc;

}());

(function () {
'use strict';

var Req = function Req(url, opts) {
    return new Req.fn.ctor(url, opts);
};

Req.fn = Req.prototype = {
    ctor: function ctor(url, opts) {
        this.url = url;
        this.opts = opts;
    },
    method: function method(_method) {},
    get: function get() {},
    post: function post() {}
};

Req.fn.ctor.prototype = Req.fn;

wc.inject('http', Req, true);

}());

(function () {
'use strict';

var time_now = Date.now || function () {
    return new Date().getTime();
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
        previous = options.leading === false ? 0 : time_now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
    };

    return function () {
        var now = time_now();
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

/**
 * 下载js或css（动态添加script、link的方式）
 * 
 * @param {any} settings 
 * @param {any} cb 
 */
function loadJS_CSS(settings, cb) {

    var url = void 0;

    if (typeof settings === 'string') {
        url = settings;
        settings = {
            callback: cb
        };
    } else {
        url = settings.url;
    }

    var charset = settings.charset || 'utf-8',
        isCSS = url && /\.css(?:\?|$)/i.test(url);

    var node = document.createElement(isCSS ? 'link' : 'script');

    node.charset = isFunction(charset) ? charset() : charset;

    settings.crossorigin && (node.crossorigin = settings.crossorigin);

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
    );function addOnload(nodeP, callback, uri, p_isCSS) {
        var supportOnload = 'onload' in nodeP;

        // for Old WebKit and Old Firefox
        if (p_isCSS && (isOldWebKit || !supportOnload)) {
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
            isLoaded;

        // for WebKit < 536
        if (isOldWebKit) {
            if (sheet) {
                isLoaded = true; // for Firefox < 9.0
            }
        } else if (sheet) {
            try {
                if (sheet.cssRules) {
                    isLoaded = true;
                }
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

/**
 * 判断当前元素是否在当前可视区域内
 * 
 * @param {any} selector 元素选择器(只取一个)
 * @param {any} threshold 偏移阈值
 * @returns 
 */
function isInVisualArea(selector, threshold) {

    threshold = threshold || 0;

    var target = jQ(selector),
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

var jQ = window.$;

window.$ && delete window.$;
window.jQuery && delete window.jQuery;

wc.inject('$', function (selector) {
    if (!selector) {
        return jQ(this.ctx);
    }
    return this.ctx ? jQ(this.ctx).find(selector) : jQ(selector);
}, true).inject('util', {
    extend: jQ.extend,
    throttle: throttle,
    isInVisualArea: isInVisualArea
}).inject('res', {
    fetch: function fetch(url) {
        var def = jQ.Deferred();
        loadJS_CSS(url, function (err, data) {
            return err ? def.reject(err) : def.resolve('ok');
        });
        return def.promise();
    }
}, true);

var $doc = jQ(document).ready(function () {
    wc.load();
    wc.pub('ready');
});

var $w = jQ(window).on('scroll', throttle(function () {
    return wc.pub('scroll', [$w.scrollTop(), $w.scrollLeft()]);
}, 300)).on('resize', throttle(function () {
    return wc.pub('resize', [$w.width(), $w.height(), $doc.width(), $doc.height()]);
}, 300)).on('loaded', function () {
    return wc.pub('loaded');
});

}());

(function () {
'use strict';

wc.inject('tpl', function (tplname, context) {

    return nunjucks.render(tplname, context);
}, true);

}());

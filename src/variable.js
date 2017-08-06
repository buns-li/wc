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
export const waitingSubscribers = {}

/**
 * 框架的组件集合
 * @type {[type]}
 */
export const cmps = {}


/**
 * 剩余的还未装载成功的组件id列表
 * @type {[type]}
 */
export const remainCmps = []

/**
 * 浏览器宿主允许被订阅的主题
 * @type {Array}
 */
export const browserActions = [
    'ready',
    'loaded',
    'scroll',
    'resize'
]

/**
 * 可以被允许注入的
 * @type {Array}
 */
export const allowWeblize = [
    '$',
    'http',
    'tpl',
    'anim',
    'cache'
]

/**
 * 框架的配置信息
 * @type {Object}
 */
export const conf = {}
/**
 * 存储框架所需的基础变量
 */

/**
 * 允许的自定义注入对象的归类
 * @type {Array}
 */
export const allowUsage = [
    '$',
    'http',
    'tpl',
    'util',
    'anim',
    'cache',
    'res'
]

/**
 * 浏览器宿主允许被订阅的主题
 * @type {Array}
 */
export const allowBrowserTopics = [
    'ready',
    'loaded',
    'scroll',
    'resize'
]

/**
 * 组件状态
 * @type {Object}
 */
export const STATE = {
    unfetch: 0,
    fetching: 1,
    fetched: 2,
    loaded: 3
}

/**
 * 框架的组件集合
 * @type {[type]}
 */
export const cmps = {}

/**
 * 剩余的还未fetch的组件集合
 */
export const remain_cmps = {}

/**
 * 所有主题的存储
 * @type {Object}
 */
export const topics = {}

/**
 * 等待被呼叫的主题
 */
export const waiting_call = {}

/**
 * 当前主题发布跟踪对象
 */
export const cur_topic_tracing = {}

/**
 * 框架的配置信息
 * @type {Object}
 */
export const conf = {}

/**
 * 框架的注入对象存储地
 * @type {Object}
 */
export const injectors = {}

/**
 * 异常枚举
 * @type {Object}
 */
export const ERRFLAG = {
    'E101': '组件的id不能为空',
    'E102': '此次调用的恢复过程受阻,由于接收不到恢复信号',
    'E103': '注入器没有对应的具体实现,请使用wc.inject()来填充此注入器',
    'W101': '组件对外自定义的注入器不包含在($、http、tpl、util、anim)中',
    'W102': 'wc.inject()缺少必备参数',
    'W103': '调用wc.inject()时,如未指定replace=true的条件下,injectKV只能为键值对类型'
}
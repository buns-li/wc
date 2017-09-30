let doc = document
let head = doc.head || doc.getElementsByTagName('head')[0] || doc.documentElement
let baseElement = head.getElementsByTagName('base')[0]

// `onload` event is not supported in WebKit < 535.23 and Firefox < 9.0
// ref:
//  - https://bugs.webkit.org/show_activity.cgi?id=38995
//  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
//  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
let isOldWebKit = +navigator.userAgent.replace(/.*(?:AppleWebKit|AndroidWebKit)\/?(\d+).*/i, '$1') < 536

// let isWebWorker = typeof window === 'undefined' && typeof importScripts !== 'undefined' && (typeof importScripts === 'function')

/**
 * 下载js或css（动态添加script、link的方式）
 *
 * @param {any} settings
 * @param {any} cb
 */
function loadJSCSS(settings, cb) {

    let url

    if (typeof settings === 'string') {
        url = settings
        settings = {
            callback: cb
        }
    } else {
        url = settings.url
    }

    let isCSS = url && /\.css(?:\?|$)/i.test(url)

    let node = document.createElement(isCSS ? 'link' : 'script')

    node.charset = 'utf-8'
    node.crossOrigin = true

    if (isCSS) {
        node.rel = 'stylesheet'
    } else {
        node.async = true
        node.type = settings.type || 'text/javascript'
    }

    addOnload(node, settings.callback, url || 'inline-script', isCSS)

    isCSS ? (node.href = url) : (node.src = url)

    // ref: #185 & http://dev.jquery.com/ticket/2709
    baseElement ? head.insertBefore(node, baseElement) : head.appendChild(node)

    // 借鉴seajs
    function addOnload(nodeP, callback, uri, isCSS) {
        let supportOnload = 'onload' in nodeP

        // for Old WebKit and Old Firefox
        if (isCSS && (isOldWebKit || !supportOnload)) {
            setTimeout(function () {
                pollCss(nodeP, callback)
            }, 1) // Begin after nodeP insertion
            return
        }

        if (supportOnload) {
            nodeP.onload = onload
            nodeP.onerror = function () {
                onload({
                    uri: uri,
                    node: nodeP
                })
            }
        } else {
            nodeP.onreadystatechange = function () {
                if (/loaded|complete/.test(nodeP.readyState)) {
                    onload()
                }
            }
        }

        function onload(error) {
            // Ensure only run once and handle memory leak in IE
            nodeP.onload = nodeP.onerror = nodeP.onreadystatechange = null
            // Dereference the nodeP
            nodeP = null
            callback && callback(error)
        }
    }

    function pollCss(nodeP, callback) {
        let sheet = nodeP.sheet,
            isLoaded

        // for WebKit < 536
        if (isOldWebKit) {
            if (sheet) isLoaded = true // for Firefox < 9.0
        } else if (sheet) {
            try {
                if (sheet.cssRules) isLoaded = true
            } catch (ex) {
                // The value of `ex.name` is changed from "NS_ERROR_DOM_SECURITY_ERR"
                // to "SecurityError" since Firefox 13.0. But Firefox is less than 9.0
                // in here, So it is ok to just rely on "NS_ERROR_DOM_SECURITY_ERR"
                if (ex.name === 'NS_ERROR_DOM_SECURITY_ERR') {
                    isLoaded = true
                }
            }
        }

        setTimeout(function () {
            if (isLoaded) {
                // Place callback here to give time for style rendering
                callback && callback()
            } else {
                pollCss(nodeP, callback)
            }
        }, 20)
    }
}

let jQ = window.$

wc.web('http', function Request(url, options) {

    //判断url是否是js请求或css请求
    let lastIndex = url.lastIndexOf('.')

    let ext = url.substring(lastIndex + 1, url.length)
    let promise
    if (ext === 'css' || ext === 'js') {
        let def = jQ.Deferred()
        loadJSCSS(url, err => err ? def.reject(err) : def.resolve('ok'))
        promise = def.promise()
        promise.catch = promise.error || promise.fail
        return promise
    }

    let newOpts = jQ.extend({
        url: url
    }, options)

    promise = $.ajax(newOpts)

    promise.catch = promise.error || promise.fail

    return promise
})
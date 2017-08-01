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

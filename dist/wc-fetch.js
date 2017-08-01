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

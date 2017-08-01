let Req = function(url, opts) {
    return new Req.fn.ctor(url, opts)
}

Req.fn = Req.prototype = {
    ctor: function(url, opts) {
        this.url = url
        this.opts = opts
    },
    method: function(method) {

    },
    get: function() {

    },
    post: function() {

    }
}

Req.fn.ctor.prototype = Req.fn

wc.inject('http', Req, true)
wc.define('cmp2', {}, function() {

    var self = this

    var $ctx = self.$(self.ctx)

    this
        .env('ready', function() {
            console.log('cmp2-ready')

            let html = self.tpl('<section><button>{{title}}</button></section>', {
                title: '求爱'
            }, true)

            console.log($ctx.html(html).find('button').on('click', function() {
                self.pub('sendlove', ['i love you'])
            }))
        })
        .env('scroll', function() {
            console.log('cmp2-scroll')
        })
        .env('resize', function() {
            console.log('cmp2-resize')
        })
        .out('test2', function() {
            console.warn('test2')
        })
})
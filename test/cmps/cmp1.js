wc.define('cmp1', {}, function() {
    var self = this,
        $ctx = self.$(self.ctx)
    this
        .env('ready', function() {
            console.log('ready')
            $ctx.html('<input name="love"/>')
        })
        .env('scroll', function() {
            console.log('scroll')
        })
        .env('resize', function() {
            console.log('resize')
        })
        .out('recieve_love', function(data) {
            console.log(data)
            $ctx.find('input').val(data)
        })
})
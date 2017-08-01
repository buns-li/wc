// me.cmp('cmp1', {
//     text: 'hello'
// }, function(it) {
//     it.life('ready', function() {
//         console.log(1)
//     }).win('onScroll,onResize', function(arr) {
//         console.log(arr)
//     }).res('changeText', function(text) {
//         it.opts.text = text
//     })
// })

wc.cmp('cmp1', {}, function() {

    var self = this
    var $ctx = self.$()
    this
        .host('ready', function() {
            console.log('ready')

            $ctx.html('<input name="love"/>')
        })
        .host('scroll', function() {
            console.log('scroll');
        })
        .host('resize', function() {
            console.log('resize')
        })
        .out('recieve_love', function(data) {
            console.log(data)
            $ctx.find('input').val(data)
        })
})
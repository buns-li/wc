// me.cmp('cmp2', {
//     text: 'hello2'
// }, function(it) {
//     it
//         .behs('call')
//         .life('ready', function() {
//             console.log(1)
//             it.pub('call', 'hello world')
//         }).win('onScroll,onResize', function(arr) {
//             console.log(arr)
//         })
// })


wc.cmp('cmp2', {}, function() {

    var self = this

    this.host('ready', function() {
            console.log('cmp2-ready');

            console.log(self.$().html(`<section><button>呼叫cmp1</button></section>`).find('button').on('click', function() {
                self.pub('sendlove', ['i love you'])
            }))
        })
        .host('scroll', function() {
            console.log('cmp2-scroll');
        })
        .host('resize', function() {
            console.log('cmp2-resize');
        })
        .out('test2', function() {
            console.warn('test2');
        })
})
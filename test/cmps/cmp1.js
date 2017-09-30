wc.define('cmp1', {}, function() {
  var self = this,
    $ctx = self.$()
  this
    .hook('ready', function() {
      console.log('ready')
      $ctx.html('<input name="love"/>')
    })
    .hook('onScroll', function() {
      console.log('scroll')
    })
    .hook('onResize', function() {
      console.log('resize')
    })
    .on('recieve_love', function(data) {
      console.log(data)
      $ctx.find('input').val(data)
    })
    .hook('beforeLeave', function() {
      console.log('beforeLeave')
    })
})
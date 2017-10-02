wc.define('cmp-fsm', function() {
  var self = this

  self.fsm.init('state0')
  self.fsm.trans('actionA', 'state0', 'state1', function before() {
      console.log(arguments)
    }, function after() {
      console.log(arguments)
    })
    .trans('actionB', 'state1', 'state2', function before() { console.log('before:', arguments) }, function after() {})

  self.hook('ready', function() {
    console.log('ready')
    self.fsm.transit('actionA', 1, 2)
    self.fsm.transit('actionB', 2, 3)
  })
})
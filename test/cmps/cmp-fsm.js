wc.define('cmp-fsm', function() {
  var self = this

  var fsm = self
    .fsm('state0')
    .trans({
      name: 'actionA',
      from: 'state0',
      to: 'state1',
      before: function() {
        console.log(arguments)
      },
      after: function() {
        console.log(arguments)
      }
    })
    .trans({
      name: 'actionB',
      from: 'state1',
      to: 'state2',
      before: function() { console.log('before:', arguments) }
    })

  self.hook('ready', function() {
      console.log('ready')
      fsm.transit('actionA', 1, 2)
      self.callSelf('test', ['test'])
    })
    .on('test', function(prop) {
      console.log(prop)
    })

})
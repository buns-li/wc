export default function FSM() {
  this._trans = {}
}

FSM.prototype = {
  constructor: FSM,

  init: function (state) {
      this._prev = null
      this._state = state
  },

  trans: function (name, from, to, before, after) {
      let trans = this._trans

      trans[name] = {
          from: from,
          to: to,
          before: before,
          after: after
      }

      return this
  },

  transit: function () {

      let args = Array.prototype.slice.apply(arguments)

      let tran = this._trans[args.shift()]

      if (!tran) return

      let from = tran.from

      if (from === '*' || from === this._state || from.includes(this._state)) {

          this._prev = this._state

          tran.before && tran.before.apply(null, args)

          this._state = tran.to

          tran.after && tran.after.apply(null, args)

      } else {
          throw new Error('组件不能从' + this._state + '转换至' + tran.to + '状态')
      }
  }
}

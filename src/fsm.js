export default function FSM(state) {
  this._trans = {}
  this._prev = null
  this._state = state
}

FSM.prototype = {
  constructor: FSM,

  trans: function(config) {

    let trans = this._trans

    let state = this._state === config.from ? this._state : config.from

    let kv = trans[state] || (trans[state] = {})

    kv[config.name] = config

    return this
  },

  transit: function() {

    let args = Array.prototype.slice.apply(arguments)

    let trankv = this._trans[this._state]

    if (!trankv) {
      throw new Error('当前组件不具备从状态-' + this._state + '开始的变迁')
    }

    let tran = trankv[args.shift()]

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
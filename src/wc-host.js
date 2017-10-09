import { conf, cmps, remainCmps } from './variable'

import Component from './cmp'

import wc from './wc'

import * as util from './fns/util'

import tpl from './fns/tpl'

import * as dom from './fns/$-jq'

import Request from './fns/http-jq'

wc.fn('util', util)

wc.fn('$', dom.$)

wc.fn('tpl', tpl)

wc.fn('http', Request)


function lazyloadCmp() {

  let cmp, loadedcmp, waitingFetchCMPs = []

  if (remainCmps && remainCmps.length) {

    for (let l = remainCmps.length; l--;) {

      cmp = cmps[remainCmps[l]]

      if (cmp.state === 2) {
        Component.load(cmp)
        remainCmps.splice(l, 1)
        loadedcmp = true
        continue
      } else if (cmp.state === 0 && cmp.ctx && cmp.http && dom.isInVisualArea && dom.isInVisualArea(cmp.ctx)) {
        waitingFetchCMPs.push(cmp.id)
      }
      loadedcmp = false
    }

  } else {
    for (let cmpid in cmps) {
      if ('__env__' === cmpid) continue
      cmp = cmps[cmpid]
      switch (cmp.state) {
        case 0: //unftech
          if (cmp.state === 0 && cmp.ctx && cmp.http && dom.isInVisualArea && dom.isInVisualArea(cmp.ctx))
            waitingFetchCMPs.push(cmp.id)
          break
        case 1: //fetching
          remainCmps.push(cmp.id)
          loadedcmp = false
          break
        case 2: //fetched
          Component.load(cmp)
        case 3:
        default:
          //loaded
          loadedcmp = true
          break
      }
    }
  }

  if (!waitingFetchCMPs.length) return loadedcmp

  let len = waitingFetchCMPs.length

  if (conf.combo) {

    let url = conf.combo(waitingFetchCMPs, 'js')

    for (; len--;) cmps[waitingFetchCMPs[len]].state = 1

    len = waitingFetchCMPs.length

    Component.prototype
      .http(url)
      .then(() => {
        for (; len--;)
          Component.load(cmps[waitingFetchCMPs[len]])
      })
      .catch(() => {
        for (; len--;)
          cmps[waitingFetchCMPs[len]].state = 4 //失败 error
      })

    url = conf.combo(waitingFetchCMPs, 'css')

    Component.prototype.http(url).catch(err => console.log(err))
  }

  return loadedcmp
}

/**
 * 组件适应宿主的处理
 */

dom.jQ(function() {
  lazyloadCmp() && cmps.__env__.pub('ready')
})

let $doc = dom.jQ(document)

let $w = dom.jQ(window)
  .on('load', () => lazyloadCmp() && cmps.__env__.pub('onLoad'))
  .on('resize', util.throttle(() => lazyloadCmp() && cmps.__env__.pub('onResize', [$w.width(), $w.height(), $doc.width(), $doc.height()]), 300))
  .on('scroll', util.throttle(() => lazyloadCmp() && cmps.__env__.pub('onScroll', [$w.scrollTop(), $w.scrollLeft()]), 300))
  .on('beforeunload', (e) => cmps.__env__.pub('beforeLeave', e))
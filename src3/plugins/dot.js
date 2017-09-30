wc.web('tpl', (tplname, context, isRaw) => {
  if (isRaw) {
    return doT.template(tplname)(context)
  }
  return window.render[tplname](context)
})
wc.inject('tpl', function(tplname, context) {

    return window.render(tplname, context)

}, true)
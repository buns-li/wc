(function () {
'use strict';

wc.inject('tpl', function (tplname, context) {

    return nunjucks.render(tplname, context);
}, true);

}());

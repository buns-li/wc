import {
    allowUsage,
    injectors
} from './variable'

import * as util from './util'

for (let item, l = allowUsage.length; l--;) {
    item = allowUsage[l]
    if (conf[item]) {
        switch (item) {
            case 'util':
                injectors.util = util
                break
            case 'res':
                injectors.res = {
                    fetch: function() {
                        throw new Exception('注入项目:res.fetch缺少具体的实现,请使用wc.inject()来补全')
                    }
                }
                break
            default:
                injectors[item] = (function(usage) {
                    return function() {
                        throw new Exception('注入项目:"' + usage + '"缺少具体的实现,请使用wc.inject()来补全')
                    }
                }(item))
                break
        }
    }
}
(function() {
    (window.nunjucksPrecompiled = window.nunjucksPrecompiled || {})["tpl_undefined"] = (function() {
        function root(env, context, frame, runtime, cb) {
            var lineno = null;
            var colno = null;
            var output = "";
            try {
                var parentTemplate = null;
                output += "<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset=\"utf-8\">\n    <title>";
                output += runtime.suppressValue(runtime.contextOrFrameLookup(context, frame, "title"), env.opts.autoescape);
                output += "</title>\n  </head>\n  <body>\n      <h5>\n        ";
                output += runtime.suppressValue(runtime.contextOrFrameLookup(context, frame, "test"), env.opts.autoescape);
                output += "\n      </h5>\n  </body>\n</html>\n";
                if (parentTemplate) {
                    parentTemplate.rootRenderFunc(env, context, frame, runtime, cb);
                } else {
                    cb(null, output);
                };
            } catch (e) {
                cb(runtime.handleError(e, lineno, colno));
            }
        }
        return {root: root};

    })();
    return function(ctx, cb) {
        return nunjucks.render("tpl_undefined", ctx, cb);
    }
})();

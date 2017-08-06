'use strict'

const

    path = require('path'),

    gulp = require('gulp'),

    clean = require('gulp-clean'),

    rollup = require('rollup').rollup,

    commonjs = require('rollup-plugin-commonjs'),

    nodeResolve = require('rollup-plugin-node-resolve'),

    rollbabel = require('rollup-plugin-babel'),

    jsmin = require('gulp-uglify'),

    concat = require('gulp-concat'),

    rename = require('gulp-rename'),

    browserSync = require('browser-sync').create(),

    yargs = require('yargs')

// function addIIFEWrapper() {

//     const wrap_start = `(function(){`

//     const wrap_end = `}())`

//     return through.obj(async function(file, encoding, cb) {

//         if (file.isNull()) {
//             cb(null, file)
//             return
//         }

//         if (file.isStream()) {
//             cb(new gutil.PluginError('wc.addIIFE', 'Streaming not supported'))
//             return
//         }

//         let filePath = file.path

//         try {

//             file.contents = new Buffer(wrap_start + file.contents.toString() + wrap_end)

//         } catch (ex) {
//             this.emit('error', new gutil.PluginError('wc.addIIFE', ex, {
//                 fileName: filePath
//             }))
//         }

//         cb(null, file)
//     })
// }

const rollUpPlugins = [
        nodeResolve({
            jsnext: true
        }),
        commonjs(),
        rollbabel({
            runtimeHelpers: true
        })
    ],
    entryRoot = './src/',
    entryDist = './dist/'


// const argvArr = [{
//     arg: '$',
//     dir: 'dom/',
//     dft: 'jquery'
// }, {
//     arg: 'h',
//     dir: 'http/',
//     dft: 'ajax'
// }, {
//     arg: 't',
//     dir: 'tpl/',
//     dft: 'nunjucks'
// }, {
//     arg: 'c',
//     dir: 'cache/',
//     optional: true
// }]

// let concatName = []

// let argv = yargs.argv

// if (argv.H) {
//     console.log('Example')
//     console.log('--$ %s', 'dom操作的注入器类型(jquery、zepto、sizzle)')
//     console.log('--h %s', 'http操作的注入器类型(ajax、fetch)')
//     console.log('--t %s', '模板引擎操作的注入器类型(nunjucks、dot、artTemplate等)')
//     console.log('--c %s', 'cache操作的注入器类型(cookie、localstorage、indexdb等)')
// } else {

//     argvArr.forEach(item => {

//         if (!argv[item.arg] && item.optional) return

//         let name = argv[item.arg] || item.dft

//         concatName.push(name)

//         gulp.task(name, () => {
//             return rollup({
//                 entry: entryRoot + item.dir + name,
//                 plugins: rollUpPlugins
//             }).then(bundle => {
//                 return bundle.write({
//                     format: 'iife',
//                     dest: entryDist + `wc-${name}.js`
//                 })
//             })
//         })
//     })
// }

gulp.task('clean', () => {
    return gulp.src('./dist/*')
        .pipe(clean())
})

gulp.task('build-base', async function buildBaseWC() {
    let bundle = await rollup({
        entry: './src/wc.js',
        plugins: rollUpPlugins
    })
    return bundle.write({
        format: 'iife',
        dest: path.join(entryDist, 'wc-core.js')
    })
})

gulp.task('build-plugins', async function buildBaseWC() {
    let bundle = await rollup({
        entry: './src/plugins/jq-dom.js',
        plugins: rollUpPlugins
    })

    let bundle2 = await rollup({
        entry: './src/plugins/jq-http.js',
        plugins: rollUpPlugins
    })

    let bundle3 = await rollup({
        entry: './src/plugins/njk.js',
        plugins: rollUpPlugins
    })

    return Promise.all([
        bundle.write({
            format: 'iife',
            dest: path.join(entryDist, 'jq-dom.js')
        }),
        bundle2.write({
            format: 'iife',
            dest: path.join(entryDist, 'jq-http.js')
        }),
        bundle3.write({
            format: 'iife',
            dest: path.join(entryDist, 'njk.js')
        })
    ])
})

gulp.task('build-polyfill', async function buildBaseWC() {
    let bundle = await rollup({
        entry: './src/wc-polyfill.js',
        plugins: rollUpPlugins
    })
    return bundle.write({
        format: 'iife',
        dest: path.join(entryDist, 'wc-polyfill.js')
    })
})

gulp.task('concat-mini', () => {
    return gulp.src(['./dist/wc-core.js', './dist/wc-polyfill.js', './dist/jq-dom.js', './dist/jq-http.js', './dist/njk.js'])
        .pipe(concat('wc-jq-njk.js'))
        .pipe(gulp.dest('./dist'))
        .pipe(jsmin({ compress: true }))
        .pipe(rename(path => {
            path.basename += '.min'
            path.extname = '.js'
        }))
        .pipe(gulp.dest('./dist'))
})

gulp.task('clean-unuse', () => {
    return gulp.src(['./dist/wc-polyfill.js', './dist/jq-dom.js', './dist/jq-http.js', './dist/njk.js'])
        .pipe(clean())
})

gulp.task('default', gulp.series(
    'clean',
    gulp.parallel('build-polyfill', 'build-base', 'build-plugins'),
    'concat-mini',
    'clean-unuse'
    // ,gulp.parallel.apply(gulp, concatName),

    // () => gulp.src(['./dist/wc.js', './dist/wc-*.js'])
    // .pipe(concat('wc-' + concatName.join('-') + '.js'))
    // .pipe(gulp.dest(entryDist)),

    // () => gulp.src('./dist/wc-' + concatName.join('-') + '.js')
    // .pipe(jsmin({ compress: true }))
    // .pipe(rename(path => {
    //     path.basename += '.min'
    //     path.extname = '.js'
    // }))
    // .pipe(gulp.dest(entryDist))
))

gulp.task('localsrv', () => {
    browserSync.init({
        server: {
            baseDir: './'
        }
    })
})
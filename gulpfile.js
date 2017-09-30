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

  browserSync = require('browser-sync').create()

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
    input: './src/wc-host.js',
    plugins: rollUpPlugins
  })
  return bundle.write({
    format: 'iife',
    file: path.join(entryDist, 'wc-jq.js')
  })
})

gulp.task('build-polyfill', async function buildBaseWC() {
  let bundle = await rollup({
    input: './src/wc-polyfill.js',
    plugins: rollUpPlugins
  })
  return bundle.write({
    format: 'iife',
    file: path.join(entryDist, 'wc-polyfill.js')
  })
})

gulp.task('min-js', () => {
  return gulp.src(['./dist/wc-polyfill.js', './dist/wc-jq.js'])
    .pipe(jsmin({ compress: true }))
    .pipe(rename(path => {
      path.basename += '.min'
      path.extname = '.js'
    }))
    .pipe(gulp.dest('./dist'))
})

gulp.task('full-wc', () => {
  return gulp.src(['./dist/wc-polyfill.js', './dist/wc-jq.js'])
    .pipe(concat('wc-jq-full.js'))
    .pipe(gulp.dest('./dist'))
    .pipe(jsmin({ compress: true }))
    .pipe(rename(path => {
      path.basename += '.min'
      path.extname = '.js'
    }))
    .pipe(gulp.dest('./dist'))
})

gulp.task('default', gulp.series(
  'clean',
  gulp.parallel('build-polyfill', 'build-base'),
  'min-js'
))

gulp.task('full', gulp.series(
  'clean',
  gulp.parallel('build-polyfill', 'build-base'),
  'full-wc'
))

gulp.task('localsrv', () => {
  browserSync.init({
    server: {
      baseDir: './'
    }
  })
})
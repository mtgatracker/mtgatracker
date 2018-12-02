var browserify = require('browserify');
var babel = require('gulp-babel');
var gulp = require('gulp');
var less = require('gulp-less');
var browserSync = require('browser-sync').create();
var cleanCSS = require('gulp-clean-css');
var rename = require("gulp-rename");
var uglify = require('gulp-uglify');
var pkg = require('./package.json');
var cacheBuster = require('gulp-cache-bust');
var gulpUtil = require('gulp-util');
var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");
var sourcemaps = require("gulp-sourcemaps");

// Compile LESS files from /less into /css
function compileLess() {
    return gulp.src('less/style.less')
        .pipe(less())
        .pipe(gulp.dest('dist/css'))
}
gulp.task('less', compileLess);

// Minify compiled CSS
function minifyCSS() {
    return gulp.src('dist/css/style.css')
        .pipe(cleanCSS({ compatibility: 'ie8' }))
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/css'))
}
gulp.task('minify-css', gulp.series('less', minifyCSS));

// Copy JS to dist
function copyJS() {
    return gulp.src(['js/**/*.js'])
        .pipe(babel())
        .pipe(gulp.dest('dist/js'))
}
gulp.task('js', copyJS)

// Minify JS
function minifyJS() {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './js/main.js',
    debug: true
  });

  return b.bundle()
    .pipe(source('bundle.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(babel())
    .pipe(uglify())
      .on('error', gulpUtil.log)
    .pipe(rename({ suffix: '.min' }))
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest('./dist/js/'));
}

gulp.task('minify-js', gulp.series('js', minifyJS));

// CACHE BUSTER
// cacheBuster looks at the css and js files and appends a hash to the
// request to cause the file to get reloaded when the file changes.
function cacheBust() {
    gulp.src(['deck/index.html'])
        .pipe(cacheBuster())
          .on('error', gulpUtil.log)
        .pipe(gulp.dest('deck/'));

    gulp.src(['game/index.html'])
        .pipe(cacheBuster())
          .on('error', gulpUtil.log)
        .pipe(gulp.dest('game/'));

    gulp.src(['login/index.html'])
        .pipe(cacheBuster())
          .on('error', gulpUtil.log)
        .pipe(gulp.dest('login/'));

    return gulp.src(['index.html'])
        .pipe(cacheBuster())
          .on('error', gulpUtil.log)
        .pipe(gulp.dest('./'));
}

gulp.task('cache-bust', gulp.series('minify-css', 'minify-js', cacheBust));

// Run everything
gulp.task('default', gulp.series(gulp.parallel(minifyCSS, minifyJS), cacheBust));

function reloadBrowser(done) {
  browserSync.reload()
  done()
}

// Configure the browserSync task
gulp.task('browserSync', function(done) {
    browserSync.init({
        server: ".",
    })
    done()
})

function watchFiles() {
    gulp.watch('less/*.less', gulp.series('minify-css', reloadBrowser));
    gulp.watch('js/**/*.js').on('change', gulp.series('minify-js'));
    return gulp.watch('dist/js/bundle.min.js', reloadBrowser);
}

// Dev task with browserSync
gulp.task('dev', gulp.series('default', 'browserSync', watchFiles));

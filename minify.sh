minify ./public/css/app.css ./public/css/animate.css ./public/css/avenir.css ./public/css/scene.css ./public/css/snackbar.css ./public/css/tooltip.css ./public/css/splide.min.css ./public/css/materialdesignicons.min.css > ./public/css/bundle.min.css && 
minify ./public/js/axios.min.js ./public/js/scene.js ./public/js/app.js ./public/js/lottie.js ./public/js/swipe.js ./public/js/pwa.js ./public/js/status.js ./public/js/snackbar.js ./public/js/splide.min.js > ./public/js/bundle.min.js && 
minify ./public/index_edit.html > ./public/index.html && 
tr -d '\n' < ./public/json/works_edit.json | tr -s " " > ./public/json/works.json


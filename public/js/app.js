const spinner = document.getElementById('spinner')
const start = document.getElementById('start')
const app = document.getElementById('app')
const bgvideo = document.getElementById('bgVideo')
const endpoint = 'https://api.overlemon.com'
let videos = []
let curvideo = -1

var playSound = (audio, vol) => {
  if (vol === undefined) vol = 1
  if (audio === undefined) audio = 'bell.mp3'

  const pref = JSON.parse(localStorage.getItem('player')) || {}
  const sound = new Audio('/sound/' + audio)
  sound.volume = vol

  var playPromise = sound.play()

  if (playPromise !== undefined) {
    playPromise.then(_ => {
      // Automatic playback started!
      // Show playing UI.
    })
    .catch(error => {
      console.log(error)
    // Auto-play was prevented
    // Show paused UI.
    })
  }
}

var startapp = () => {
  start.classList.remove('flipInX')
  start.classList.add('fadeOut')
  setTimeout(() => {
    start.remove()
    app.classList.add('animated', 'fadeIn')
    document.querySelector('.mainlogo').classList.add('fadeIn')
    document.querySelector('.footer').classList.add('fadeIn')
    document.querySelector('.mobile-menu').classList.add('fadeIn')
    if (!location.hash) {
      location.hash = 'landing'
    }
    playSound('start.mp3', 0.25)
    startVideos()
    setTimeout(() => {
      canPlaySound = true
    }, 1000)
  }, 1000)
}

let seekVideo = e => {
  if (e && e.target.classList.contains('mdi-inactive')) {
    return false
  }
  if (curvideo + 1 >= videos.length) {
    curvideo = -1
  }
  curvideo++
  let skip = document.querySelector('.carousel__cell__buttons .mdi-skip-next')
  bgvideo.setAttribute('src', `${endpoint}/v/${videos[curvideo]}`)
  skip.classList.remove('mdi-inactive')
  skip.classList.add('mdi-inactive')
  setTimeout(() => {
    bgvideo.play()
    bgvideo.addEventListener('canplaythrough', function (e) {
      skip.classList.remove('mdi-inactive')
    })
    findReaders(document.querySelector('.carousel'))
  }, 1000)
  console.log(`playing ${videos[curvideo]}`)
}

let startVideos = () => {
  axios.get(`${endpoint}/list_videos`).then(res => {
    if (res.data) {
      videos = res.data
      seekVideo()
    }
    bgvideo.addEventListener('ended', seekVideo, false)
  })
}

/* letsworktogether */

let sendMessage = form => {
  form.style.opacity = 0.5
  form.querySelector('button[type="submit"]').innerHTML = 'Sending...'
  const formData = new FormData(form)
  var data = {}
  formData.forEach(function(value, key){
    data[key] = value
  })
  // axios.post(`http://localhost:5000/contact`, json).then(res => {
  axios.post(`https://api.overlemon.com/contact`, data).then(res => {
    form.reset()
    form.style.opacity = 1
    form.querySelector('button[type="submit"]').innerHTML = 'Send'
    const template = (`
<div>
  <div class="works_detail">
    <h1 class="letsworktogether_status">${res.data.status}</h1>
    <p class="letsworktogether_message">${res.data.message}</p>
  </div>
  <a href="#landing" class="button"><span class="mdi mdi-chevron-left"></span> home</a>
</div>`)
    document.querySelector('.lwt_result_content').innerHTML = `${template}`
    location.href = '#lwt_result'
    // snackbar(res.data.status, res.data.message)
  })
  return false
}

document.addEventListener('DOMContentLoaded', () => {
  // alert(window.screen.availWidth + ' ' + window.screen.availHeight)
  document.getElementById('menu').addEventListener('click', () => {
    if (!document.getElementById('menu').classList.contains('fs')) {
      setTimeout(() => {
        playSound('menu.mp3', 0.25)
      }, 175)
    }
    document.getElementById('menu').classList.toggle('fs')
    document.getElementById('menu').querySelector('.burger').classList.toggle('cross')
  })

  /* preload */
  setTimeout(() => {
    spinner.classList.add('animated', 'fadeOut')
    setTimeout(() => {
      spinner.remove()
      start.classList.add('animated', 'flipInX')
      playSound('ready.mp3', 0.25)
    }, 1000)
  }, 1000)

  /* works */
  axios.get('/json/works.json').then(res => {
    let works = res.data
    res.data.forEach((work, i) => {
      let ul = document.getElementById('works').querySelector('ul')
      let li = document.createElement('li')
      li.style.backgroundImage = `url('${work.image}')`
      li.className = 'splide__slide is-hoverable'
      li.setAttribute('dataindex', i)
      ul.append(li)
    })

    setTimeout(() => {
      const splide = new Splide( '#works', {
        gap: '1rem',
        arrows: false,
        pagination: false,
        fixedWidth: '9rem',
        fixedHeight: '9rem'
      } ).mount()

      splide.on('click', slide => {
        const i = slide.slide.getAttribute('dataindex')
        const work = works[i]
        location.href = `#work:${work.slug}`
      })
    }, 1)
  })
})

/* <span class="tag">${work.arch.join('</span><span class="tag">')} ${work.repo}</span><br> */
/*
window.onerror = function (msg, url, lineNo, columnNo, error) {
  alert(`error: ${msg}:${lineNo}`)
}*/
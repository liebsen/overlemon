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
  start.classList.add('animated', 'fadeOut')
  setTimeout(() => {
    app.classList.add('animated', 'flipInY')
    start.remove()
    playSound('start.mp3')
    axios.get(`${endpoint}/list_videos`).then(res => {
      if (res.data) {
        videos = res.data
        playVideo()
      }
      bgvideo.addEventListener('ended', playVideo, false)
      canPlaySound = true
    })
  }, 1000)
}

let playVideo = () => {
  if (curvideo + 1 >= videos.length) {
    curvideo = -1
  }
  curvideo++
  console.log(`playing ${videos[curvideo]}`)
  bgvideo.setAttribute('src', `${endpoint}/${videos[curvideo]}`)
  setTimeout(() => {
    bgvideo.play()
  }, 5000)  
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
    document.querySelector('.letsworktogether_status').innerHTML = res.data.status
    document.querySelector('.letsworktogether_message').innerHTML = res.data.message
    location.href = '#letsworktogether_result'
    // snackbar(res.data.status, res.data.message)
  })
  return false
}

document.addEventListener('DOMContentLoaded', () => {

  // alert(window.screen.availWidth + ' ' + window.screen.availHeight)
  document.getElementById('menu').addEventListener('click', () => {
    if (!document.getElementById('menu').classList.contains('fs')) {
      setTimeout(() => {
        playSound('rotate.mp3')
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
      start.classList.add('animated', 'rotateInUpLeft')
      setTimeout(() => {
        playSound('ready.mp3')  
      }, 1000)
    }, 1000)
  }, 1000)


  /* works */
  axios.get('/json/works.json').then(res => {
    let works = res.data
    res.data.forEach((work, i) => {
      let ul = document.getElementById('works').querySelector('ul')
      let li = document.createElement('li')
      // let a = document.createElement('a')
      repo = ''
      // a.href = '#'
      li.style.backgroundImage = `url('${work.image}')`
      li.className = 'splide__slide'
      li.setAttribute('dataindex', i)
      ul.append(li)
      if (work.github) {
        Object.keys(work.github).forEach(function(key) {
          repo+= `<span><span class="mdi mdi-github"></span> <a href="${work.github[key]}" target="_blank">${key}</a></span>&nbsp;`
        })
      }
      works[i].repo = repo
    })

    setTimeout(() => {
      const splide = new Splide( '#works', {
        type   : 'loop',
        gap: '1rem',
        focus  : 'center',
        arrows: false,
        pagination: false,
        perPage    : 1,
        fixedWidth     : '8rem',
        fixedHeight     : '8rem'
      } ).mount()

      splide.on('click', slide => {
        const i = slide.slide.getAttribute('dataindex')
        const work = works[i]
        const template = (`
<div class="work has-text-left">
  <h1>${work.title}</h1>
  <a href="${work.url}" target="_blank" title="Go to application"><div class="is-background-img" style="background-image: url(${work.screen})"></div></a>
  <p><strong>Slogan</strong> ${work.slogan}</p>
  <p><strong>Description</strong> ${work.text}</p>
  <p><span class="tag">${work.tech.join('</span><span class="tag">')}</span><span class="tag">${work.arch.join('</span><span class="tag">')}</span></p>
  <p><strong>Company</strong>${work.country} ${work.company}</p>
  <p>${work.repo}</p>
</div>`)
        document.querySelector('.works_detail').innerHTML = `${template}`
        location.href = '#work'
      })
    }, 1000)
  })
})

window.onerror = function (msg, url, lineNo, columnNo, error) {
  alert(`error: ${msg}:${lineNo}`)
}




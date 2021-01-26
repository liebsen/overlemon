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
      start.classList.add('animated', 'fadeIn', 'delay')
      setTimeout(() => {
        playSound('ready.mp3')  
      }, 700)
    }, 1000)
  }, 1000)

  /* works */
  axios.get('/json/works.json').then(res => {
    res.data.forEach(work => {
      let ul = document.getElementById('works').querySelector('ul')
      let li = document.createElement('li')
      // let a = document.createElement('a')
      work.repo = ''
      // a.href = '#'
      li.style.backgroundImage = `url('${work.image}')`
      li.className = 'splide__slide'
      // li.innerHTML = `<h4>${work.title}</h4>`
      ul.append(li)
      if (work.github) {
        Object.keys(work.github).forEach(function(key) {
          work.repo+= `<span><span class="mdi mdi-github"></span> <a href="${work.github[key]}" class="has-text-dark" target="_blank">${key}</a></span>&nbsp;`
        })
      }
      li.onclick = e => {
        const template = (`
  <div class="work has-text-left">
    <p><strong>Slogan</strong> ${work.slogan}</p>
    <p><strong>Technologies</strong> <span class="tag">${work.tech.join('</span><span class="tag">')}</span></p>
    <p><strong>Architecture</strong> <span class="tag">${work.arch.join('</span><span class="tag">')}</span></p>
    <p><strong>Company</strong> ${work.company} ${work.country}</p>
    <p><strong>Description</strong> ${work.text}</p>
    <p>${work.repo}</p>
    <a href="${work.url}" target="_blank" title="Go to application"><div class="is-background-img" style="background-image: url(${work.screen})"></div></a>
  </div>`)
        setTimeout(() => {
          playSound('pop.mp3')
        }, 75)
        swal({
          title: work.title,
          // buttons: ['Cancel', 'Go to app'],
          content: {
            element: 'div',
            attributes: {
              innerHTML: `${template}`
            }
          }
        })
      }
    })

    setTimeout(() => {
      console.log(document.getElementById('works'))
      new Splide( '#works', {
        type   : 'loop',
        gap: '1rem',
        focus  : 'center',
        pagination: false,
        perPage    : 1,
        fixedWidth     : '10rem',
        fixedHeight     : '10rem'
      } ).mount()
    }, 1000)
  })
})

window.onerror = function (msg, url, lineNo, columnNo, error) {
  alert(`error: ${msg}:${lineNo}`)
}




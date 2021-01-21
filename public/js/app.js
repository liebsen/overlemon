let spinner = document.getElementById('spinner')
let start = document.getElementById('start')
let app = document.getElementById('app')
var canPlaySound = false
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
    const bgvideo = document.getElementById('bgVideo')
    app.classList.add('animated', 'flipInY')
    start.remove()
    playSound('start.mp3')
    setTimeout(() => {
      bgvideo.classList.add('animated', 'hyperslow', 'fadeIn')
      bgvideo.setAttribute('src', 'https://api.overlemon.com/bg_video')
      bgvideo.play()
      canPlaySound = true
    }, 1000)
  }, 1000)
}

document.addEventListener('DOMContentLoaded', () => {

  // alert(window.screen.availWidth + ' ' + window.screen.availHeight)
  document.getElementById('menu').addEventListener('click', () => {
    if (!document.getElementById('menu').classList.contains('fs')) {
      setTimeout(() => {
        playSound('menu.mp3')
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
      start.classList.add('animated', 'fadeIn')
    }, 1000)
  }, 1000)

  /* works */
  axios.get('/json/works.json').then(res => {
    res.data.forEach(work => {
      let works = document.getElementById('works')
      let li = document.createElement('li')
      let a = document.createElement('a')
      work.repo = ''
      a.href = '#'
      a.style.backgroundImage = `url('${work.image}')`
      li.append(a)
      works.append(li)
      if (work.github) {
        Object.keys(work.github).forEach(function(key) {
          work.repo+= `<span><span class="mdi mdi-github"></span> <a href="${work.github[key]}" class="has-text-dark" target="_blank">${key}</a></span>&nbsp;`
        })
      }
      a.onclick = e => {
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
  })
})

window.onerror = function (msg, url, lineNo, columnNo, error) {
  alert(`error: ${msg}:${lineNo}`)
}




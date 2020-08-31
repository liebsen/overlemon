let spinner = document.getElementById('spinner')
let app = document.getElementById('app')
var canPlaySwapSound = false
var playSound = (audio, vol) => {
  if (vol === undefined) vol = 1
  if (audio === undefined) audio = 'bell.mp3'

  const pref = JSON.parse(localStorage.getItem('player')) || {}
  const sound = new Audio('/sound/' + audio)
  sound.vol = vol

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
      app.classList.add('animated', 'flipInY')
      playSound('start.mp3')
      setTimeout(() => {
        changeCarousel()
        setTimeout(() => {
          canPlaySwapSound = true
        }, 500)
      }, 1000)
    }, 1000)
  }, 1000)

  /* works */
  axios.get('/json/works.json').then(res => {
    res.data.forEach(work => {
      let works = document.getElementById('works')
      let li = document.createElement('li')
      let a = document.createElement('a')
      a.href = '#'
      a.style.backgroundImage = `url('${work.image}')`
      li.append(a)
      works.append(li)

      a.onclick = e => {
        const template = (`
  <div class="work has-text-left">
    <p>${work.slogan}</p>
    <p><strong>Technologies</strong> <span class="tag">${work.tech.join('</span><span class="tag">')}</span></p>
    <p><strong>Architecture</strong> <span class="tag">${work.arch.join('</span><span class="tag">')}</span></p>
    <p><strong>Company</strong> ${work.company} ${work.country}</p>
    <p><strong>Description</strong> ${work.text}</p>
    <div class="is-background-img" style="background-image: url(${work.screen})"></div>
  </div>`)
        setTimeout(() => {
          playSound('pop.mp3')
        }, 75)
        swal({
          title: work.title,
          buttons: ['Cancel', 'Go to app'],
          content: {
            element: 'div',
            attributes: {
              innerHTML: `${template}`
            }
          }
        }).then(accept => {
          if (accept) {
            window.open(work.url, '_blank')
          }
        })
        e.preventDefault()
      }
    })
  })
})

window.onerror = function (msg, url, lineNo, columnNo, error) {
  alert(`error: ${msg}:${lineNo}`)
}




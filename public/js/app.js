let spinner = document.getElementById('spinner')
let app = document.getElementById('app')

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('menu').addEventListener('click', () => {
    document.getElementById('menu').classList.toggle('fs')
    document.getElementById('menu').querySelector('.burger').classList.toggle('cross')
  })

  /* preload */
  setTimeout(() => {
    spinner.classList.add('animated', 'fadeOut')
    setTimeout(() => {
      spinner.remove()
      app.classList.add('animated', 'rotateInDownLeft')
      setTimeout(() => {
        changeCarousel()
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
    <div class="is-background-img" style="background-image: url(${work.screen})"></div>
    <p>${work.slogan}</p>
    <p><strong>Technologies</strong> <span class="tag">${work.tech.join('</span><span class="tag">')}</span></p>
    <p><strong>Architecture</strong> <span class="tag">${work.arch.join('</span><span class="tag">')}</span></p>
    <p><strong>Company</strong> ${work.company} ${work.country}</p>
    <p><strong>Description</strong> ${work.text}</p>
  </div>`)
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




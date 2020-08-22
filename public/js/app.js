let spinner = document.getElementById('spinner')
let app = document.getElementById('app')
document.addEventListener('DOMContentLoaded', () => {

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
  <div class="content has-text-left">
    <p>${work.slogan}</p>
    <p>Country: ${work.country}</p>
    <p>Tech: ${work.techno}</p>
    <p>Description: ${work.text}</p>
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
            /*
            let link = document.createElement('a')
            a.classList.add('is-hidden')
            a.href = work.url
            a._target = 'blank'
            document.getElementById('app').append(a)
            a.click()
            */
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

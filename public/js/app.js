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
    console.log(res.data)
    res.data.forEach(work => {
      let works = document.getElementById('works')
      let li = document.createElement('li')
      let a = document.createElement('a')
      a.href = '#'
      a.style.backgroundImage = work.image

      li.append(a)
      works.append(li)

      a.click = e => {
        const template = (`
  <div class="content">
    <div class="field">
      <h3>${work.title}</h3>
    </div>
    <div class="field">
      <p>${work.slogan}</p>
    </div>
    <div class="field">
      <p>${work.text}</p>
    </div>
  </div>`)
        swal({
          title: work.title,
          content: {
            element: 'div',
            attributes: {
              innerHTML: `${template}`
            }
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

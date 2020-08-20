let spinner = document.getElementById('spinner')
let app = document.getElementById('app')
document.addEventListener('DOMContentLoaded', () => {
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
})

window.onerror = function (msg, url, lineNo, columnNo, error) {
  alert(`error: ${msg}:${lineNo}`)
}


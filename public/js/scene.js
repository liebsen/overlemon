var carousel = document.querySelector('.carousel')
var cells = carousel.querySelectorAll('.carousel__cell')
var cellCount = cells.length
var selectedIndex = 0
var cellWidth = carousel.offsetWidth
var cellHeight = carousel.offsetHeight
var isHorizontal = false
var rotateFn = isHorizontal ? 'rotateY' : 'rotateX'
var radius, theta
var canPlaySound = false

function updateCellCount () {
  let prev = cellCount
  cells = carousel.querySelectorAll('.carousel__cell:not(.hidden)')
  cellCount = cells.length
  if (prev !== cellCount) {
    changeCarousel()
  }
}
function rotateCarousel() {
  updateCellCount()
  var angle = theta * selectedIndex * -1
  carousel.style.transform = 'translateZ(' + -radius + 'px) ' + 
    rotateFn + '(' + angle + 'deg)'
  let i = selectedIndex%cellCount
  if (i < 0) {
    i+= cellCount
  }
  cells.forEach(e => {
    e.classList.remove('active')
  })
  cells[i].style.display = 'flex'
  cells[i].classList.add('active')
  setTimeout(() => {
    if (canPlaySound) {
      playSound('rotate.mp3', 0.25)
    }
  }, 200)
}


let carouselPrevDesk = () => {
  if (document.querySelector('.wrapper.active') && document.querySelector('.wrapper.active').nextElementSibling) {
    document.querySelector('.wrapper.active').nextElementSibling.click()
  } else {
    document.querySelector('#links > a:first-child').click()
  }
}

let carouselNextDesk = () => {
  if (document.querySelector('.wrapper.active') && document.querySelector('.wrapper.active').previousElementSibling) {
    document.querySelector('.wrapper.active').previousElementSibling.click()
  } else {
    document.querySelector('#links > a:last-child').click()
  }
}

let carouselPrev = () => {
  selectedIndex--
  rotateCarousel()
}

let carouselNext = () => {
  selectedIndex++
  rotateCarousel()
}

let elemIndex = e => {
  return [...e.parentElement.children].indexOf(e)
}

let onHashChange = () => {
  let section = location.hash.replace('#', '')
  if (section.length && document.querySelector(`.${section}`)) {
    document.querySelectorAll(`a`).forEach(a => {
      a.classList.remove('active')
    })
    document.querySelector(`.${section}`).classList.remove('hidden')
    document.querySelectorAll(`a[href="#${section}"]`).forEach(a => {
      a.classList.toggle('active')
    })
    selectedIndex = elemIndex(document.querySelector(`.${section}`))
    rotateCarousel()
  }
}

let changeCarousel = () => {
  //cellCount = cellsRange.value
  updateCellCount()
  theta = 360 / cellCount
  var cellSize = isHorizontal ? carousel.offsetWidth : carousel.offsetHeight
  radius = Math.round( ( cellSize / 2) / Math.tan( Math.PI / cellCount ) )
  for ( var i=0; i < cells.length; i++ ) {
    var cell = cells[i]
    var cellAngle = theta * i
    cell.style.transform = rotateFn + '(' + cellAngle + 'deg) translateZ(' + radius + 'px)'
  }
  rotateCarousel()
}

document.getElementById('app').addEventListener('wheel', event => {
  Math.sign(event.deltaY) < 0 ? carouselPrevDesk() : carouselNextDesk()
})


document.onkeydown = e => {
  switch (e.which) {

    case 32: 

      if (document.getElementById('startbtn')) {
        document.getElementById('startbtn').click()
      }
      break;
    case 37: // left
      break

    case 38: // up
      carouselPrevDesk()      
      break

    case 39: // right
      break

    case 40: // down
      carouselNextDesk()
      break

    default: return
  }
  e.preventDefault()
}

window.onresize = e => {
  location.href = location.href
}

window.addEventListener('hashchange', onHashChange, false)

onHashChange()
changeCarousel()
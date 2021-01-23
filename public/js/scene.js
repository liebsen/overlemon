var carousel = document.querySelector('.carousel')
var cells = carousel.querySelectorAll('.carousel__cell:not(.hidden)')
var cellCount = cells.length
var selectedIndex = 0
var cellWidth = carousel.offsetWidth
var cellHeight = carousel.offsetHeight
var isHorizontal = true
var rotateFn = isHorizontal ? 'rotateY' : 'rotateX'
var radius, theta

function rotateCarousel() {
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
  // document.querySelector('.animatedlogo').classList.remove('pulse')
  setTimeout(() => {
    // document.querySelector('.animatedlogo').classList.add('pulse')
    if (canPlaySound) {
      playSound('rotate.mp3', 0.25)
    }
  }, 200)
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
    document.querySelectorAll(`a[href="#${section}"]`).forEach(a => {
      a.classList.toggle('active')
    })
    selectedIndex = elemIndex(document.querySelector(`.${section}`))
    rotateCarousel()
  }
}

let changeCarousel = () => {
  //cellCount = cellsRange.value
  theta = 360 / cellCount
  var cellSize = isHorizontal ? cellWidth : cellHeight
  radius = Math.round( ( cellSize / 2) / Math.tan( Math.PI / cellCount ) )
  for ( var i=0; i < cells.length; i++ ) {
    var cell = cells[i]
    var cellAngle = theta * i
    cell.style.transform = rotateFn + '(' + cellAngle + 'deg) translateZ(' + radius + 'px) translateX(1%)'
  }
  rotateCarousel()
}

var simulateClick = (elem) => {
  // Create our event (with options)
  var evt = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  // If cancelled, don't dispatch our event
  var canceled = !elem.dispatchEvent(evt);
};

document.onkeydown = e => {
  switch (e.which) {

    case 32: 

      if (document.getElementById('startbtn')) {
        document.getElementById('startbtn').click()
      }
      break;
    case 37: // left
      if (document.querySelector('.wrapper.active').previousElementSibling) {
        document.querySelector('.wrapper.active').previousElementSibling.click()
      } else {
        document.querySelector('#links > a:last-child').click()
      }
      break

    case 38: // up
      break

    case 39: // right
      if (document.querySelector('.wrapper.active').nextElementSibling) {
        document.querySelector('.wrapper.active').nextElementSibling.click()
      } else {
        document.querySelector('#links > a:first-child').click()
      }
      break

    case 40: // down
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
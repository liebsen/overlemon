var carousel = document.querySelector('.carousel')
var cells = carousel.querySelectorAll('.carousel__cell')
var cellCount = cells.length
var selectedIndex = 0
var cellWidth = carousel.offsetWidth
var cellHeight = carousel.offsetHeight
var isHorizontal = true
var rotateFn = isHorizontal ? 'rotateY' : 'rotateX'
var radius, theta
// console.log( cellWidth, cellHeight )

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
  cells[i].classList.add('active')
}

let carouselPrev = () => {
  selectedIndex--
  rotateCarousel()
}

let carouselNext = () => {
  selectedIndex++
  rotateCarousel()
}

/*
var prevButton = document.querySelector('.previous-button')
prevButton.addEventListener( 'click', function() {
  selectedIndex--
  rotateCarousel()
})

var nextButton = document.querySelector('.next-button')
nextButton.addEventListener( 'click', function() {
  selectedIndex++
  rotateCarousel()
})

var cellsRange = document.querySelector('.cells-range')
cellsRange.addEventListener( 'change', changeCarousel )
cellsRange.addEventListener( 'input', changeCarousel )*/



function changeCarousel() {
  //cellCount = cellsRange.value
  theta = 360 / cellCount
  var cellSize = isHorizontal ? cellWidth : cellHeight
  radius = Math.round( ( cellSize / 2) / Math.tan( Math.PI / cellCount ) )
  for ( var i=0; i < cells.length; i++ ) {
    var cell = cells[i]
    var cellAngle = theta * i
    cell.style.transform = rotateFn + '(' + cellAngle + 'deg) translateZ(' + radius + 'px)'
  }
  rotateCarousel()
}
/*
var orientationRadios = document.querySelectorAll('input[name="orientation"]')
( function() {
  for ( var i=0 i < orientationRadios.length i++ ) {
    var radio = orientationRadios[i]
    radio.addEventListener( 'change', onOrientationChange )
  }
})()

function onOrientationChange() {
  var checkedRadio = document.querySelector('input[name="orientation"]:checked')
  isHorizontal = checkedRadio.value == 'horizontal'
  rotateFn = isHorizontal ? 'rotateY' : 'rotateX'
  changeCarousel()
}

// set initials
onOrientationChange()
*/

document.onkeydown = e => {
  switch (e.which) {
    case 37: // left
      carouselPrev()
      break

    case 38: // up
      break

    case 39: // right
      carouselNext()
      break

    case 40: // down
      break

    default: return
  }
  e.preventDefault()
}

window.onresize = e => {
  console.log('resize')
  changeCarousel()  
}
changeCarousel()
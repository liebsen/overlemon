var carousel = document.querySelector('.carousel')
var cells = carousel.querySelectorAll('.carousel__cell')
var wraps = document.querySelectorAll('.wrapper')
var cellCount = cells.length
var selectedIndex = 0
var cellWidth = carousel.offsetWidth
var cellHeight = carousel.offsetHeight
var isHorizontal = false
var rotateFn = isHorizontal ? 'rotateY' : 'rotateX'
var radius, theta
var canPlaySound = false
var colors = ['790c5a','cf1b1b','394989','007965','21209c','2ec1ac','11698e','8105d8','ff577f','949cdf','a685e2','6155a6','21209c','ea97ad','c24914','ec5858','e05297','52057b','2d6187','bb2205','2d6187','7579e7','0278ae','8675a9','ac4b1c','065c6f','335d2d','07689f','ec0101','206a5d','e11d74','776d8a','438a5e']
var filled = []

function updateCellCount () {
  let prev = cellCount
  cells = carousel.querySelectorAll('.carousel__cell:not(.hidden)')
  cellCount = cells.length
  distributeCarousel()
}

function findReaders(slide) {
  slide.querySelectorAll('.reader').forEach(e => {
    const chunks = e.getAttribute('data-chunks').split(' | ') || []
    const fx = e.getAttribute('data-fx') || 'fadeIn' 
    const speed = e.getAttribute('data-speed') || 3
    if (chunks.length) {
      // chunks = chunks.filter(e => e.length)
      if (!e.pos) {
        e.pos = 0
      }
      if (e.clock) {
        clearInterval(e.clock)
      }
      e.clock = setInterval(() => {
        const span = document.createElement('span')
        span.classList.add('animated', 'read', fx)
        e.innerHTML = ''
        e.appendChild(span)
        if (e.pos < chunks.length) {
          span.textContent = chunks[e.pos]
          e.pos++
        } else {
          span.textContent = e.getAttribute('data-empty') || '⠀'
          e.pos = 0
          clearInterval(e.clock)
        }   
      }, speed * 1000)
    }
  })
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
  controlVideoVolume(i)
  setTimeout(() => {
    if (canPlaySound) {
      playSound('rotate.mp3', 0.25)
    }
  }, 200)
  setTimeout(() => {
    findReaders(cells[i])
  }, 750)
}

let controlVideoVolume = (i) => {
  const video = document.getElementById('bgVideo')
  if (video) {
    fadeVideoVolume(i === cells.length - 1 ? 1 : 0.1)
  }
}

let fadeVideoVolume = (volume) => {
  const video =  document.getElementById('bgVideo')
  var fadeAudio = setInterval(() => {
    let v = parseFloat(parseFloat(video.volume.toFixed(1)))
    if (v < volume) {
      video.volume += 0.1
    } else if (v > volume) {
      video.volume -= 0.1
    } else {
      clearInterval(fadeAudio)
    }      
  }, 50)
}

let carouselPrev = () => {
  if (document.querySelector('.wrapper.active') && document.querySelector('.wrapper.active').nextElementSibling) {
    document.querySelector('.wrapper.active').nextElementSibling.click()
  } else {
    document.querySelector('#links > a:first-child').click()
  }
}

let carouselNext = () => {
  if (document.querySelector('.wrapper.active') && document.querySelector('.wrapper.active').previousElementSibling) {
    document.querySelector('.wrapper.active').previousElementSibling.click()
  } else {
    document.querySelector('#links > a:last-child').click()
  }
}

let carouselPrev2 = () => {
  selectedIndex--
  rotateCarousel()
}

let carouselNext2 = () => {
  selectedIndex++
  rotateCarousel()
}

let elemIndex = e => {
  return [...e.parentElement.children].indexOf(e)
}

let onHashChange = () => {
  let section = location.hash.replace('#', '').split(':')[0]
  if (document.getElementById('menu').classList.contains('fs')) {
    document.getElementById('menu').classList.toggle('fs')
    document.getElementById('menu').querySelector('.burger').classList.toggle('cross')
  }
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
  if (location.hash.indexOf('#work:') > -1) {
    /* work */
    const slug = location.hash.replace('#work:', '')
    axios.get('/json/works.json').then(res => {
      let work = res.data.filter(e => e.slug === slug)[0]
      const template = (`
<div class="work_detail">
<div class="work has-text-left">
  <div class="columns is-vcentered">
    <div class="column b-spaced">
      <h1>${work.title}</h1>
      <h4>${work.slogan}</h4>
      <div class="column is-mobile has-text-centered">
        <a href="${work.url}" target="_blank" title="Go to application">
          <div class="is-background-img has-margin-auto is-hoverable b-spaced" style="background-image: url(${work.screen})"></div>
        </a>
      </div>
      <p class="b-spaced">${work.text}</p>
      <p class="is-desktop"><i>Built for</i> ${work.company} ${work.country}</p>
      <div class="columns work__button_group">
        <div class="column">
          <a href="${work.url}" class="button" target="_blank" title="Go to application">
            <span class="mdi mdi-link"></span> 
            view
          </a>
        </div>
        <div class="column">
          <a href="#works" class="button">
            <span class="mdi mdi-chevron-left"></span> works
          </a>
        </div>
      </div>
    </div>
    <div class="column is-desktop has-text-centered">
      <a href="${work.url}" target="_blank" title="Go to application">
        <div class="is-background-img has-margin-auto is-hoverable b-spaced" style="background-image: url(${work.screen})"></div>
      </a>
      <hr class="is-space">
      <p>
        <span class="tag">${work.tech.join('</span><span class="tag">')}</span>
      </p>
    </div>
  </div>
</div>  
</div>`)
      document.querySelector('.work_contents').innerHTML = `${template}`
    })
  }
}

let distributeCarousel = () => {
  theta = 360 / cellCount
  var cellSize = isHorizontal ? carousel.offsetWidth : carousel.offsetHeight
  radius = Math.round( ( cellSize / 2) / Math.tan( Math.PI / cellCount ) )
  for ( var i=0; i < cells.length; i++ ) {
    var cell = cells[i]
    var cellAngle = theta * i
    cell.style.transform = rotateFn + '(' + cellAngle + 'deg) translateZ(' + radius + 'px)'
  }
}

let prepareCarousel = () => {
  //cellCount = cellsRange.value
  updateCellCount()
  distributeCarousel()
  rotateCarousel()
}

let assignColorsCarousel = () => {
  for ( var i=0; i < cells.length; i++ ) {
    var color = colors[Math.floor(Math.random() * colors.length)]
    while(filled.includes(color)) {
      color = colors[Math.floor(Math.random() * colors.length)]
    }
    cells[i].style.backgroundColor = `#${color}`
    if (wraps[i]) {
      wraps[i].querySelector('.tooltip').style.backgroundColor = `#${color}`
      wraps[i].querySelector('.icon').style.color = `#${color}`
    }
    filled.push(color)
  }
}

document.getElementById('app').addEventListener('wheel', event => {
  Math.sign(event.deltaY) < 0 ? carouselPrev() : carouselNext()
})

document.onkeydown = e => {
  // e.preventDefault()
  // console.log(e.which)
  switch (e.which) {
    case 32:
      if (document.getElementById('startbtn')) {
        document.getElementById('startbtn').click()
      }
      break;
    case 37: // left
      // carouselPrev()
      break

    case 38: // up
      carouselPrev()
      break

    case 39: // right
      // carouselNext()
      break

    case 40: // down
      carouselNext()
      break

    case 220: // secret key next video
      seekVideo()
      break

    default: return
  }
}

window.addEventListener('hashchange', onHashChange, false)
onHashChange()
assignColorsCarousel()
prepareCarousel()
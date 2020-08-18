document.onkeydown = (e) => {
  switch (e.which) {
    case 37: // left
  selectedIndex--;
  rotateCarousel();
      break

    case 38: // up
      break

    case 39: // right
  selectedIndex++;
  rotateCarousel();
      break

    case 40: // down
      break

    default: return
  }
  e.preventDefault()
}
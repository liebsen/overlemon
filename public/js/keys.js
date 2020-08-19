document.onkeydown = (e) => {
  switch (e.which) {
    case 37: // left
      prevButton.click()
      break

    case 38: // up
      break

    case 39: // right
      nextButton.click()
      break

    case 40: // down
      break

    default: return
  }
  e.preventDefault()
}
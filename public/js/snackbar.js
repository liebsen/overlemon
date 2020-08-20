var snackbarMsg = null;
var snackbarClock = null;
const snackbar = function (type, message, options) {
  var snackBarElement = document.querySelector('.ui-snackbar');
  clearInterval(snackbarClock)

  if(options===undefined) options = 5000
  if (!message) return;

  if (snackbarMsg) {
  	snackbarMsg.remove();
  }
  
  snackbarMsg = document.createElement('div');  
  snackbarMsg.className = 'ui-snackbar__message';
  snackbarMsg.classList.add('ui-snackbar--' + type);
  snackbarMsg.textContent = message;
  document.querySelector('.ui-snackbar').appendChild(snackbarMsg);
  snackBarElement.classList.remove('ui-snackbar--is-inactive')

  //Show toast for 3secs and hide it
  snackbarClock = setTimeout(() => {
    snackBarElement.classList.add('ui-snackbar--is-inactive')
  }, options);
}

System.import('../src/client/morphic/component-loader.js')
.then(loader => {
  window.l4compLoader = loader;
  loader.loadUnresolved(document.body);
});
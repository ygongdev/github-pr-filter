'use strict';

(async () => {
  const src = chrome.runtime.getURL("filterGlob-bundle.js");
  // Adds filterGlob to the global namespace;
  await import(src);

  /**
   * Globals
   */
  let globString = "";
  // Prevents toolbar creation from keep triggering mutation observer.
  const WIDGET_ID = 'glob-filter-widget';

  // Because sometimes Github is changing page content and url without triggering a reload, so we need to use a mutation observer.
  // If the page reload, the whole content-script will be reloaded.
  const filterObserver = new MutationObserver(debounce(run, 1000));
  filterObserver.observe(document.body, { childList: true, subtree: true });

  run();

  function debounce(fn, rate) {
    let timer;
  
    return function() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      timer = setTimeout(() => {
        fn.apply(this, arguments)
      }, rate);
    }
  }

  function isPRPage() {
    // location.href doesn't seem to capture 'www.', so this pattern here is a bit different from the manifest.json
    return filterGlob([location.href], '*://*github.com/**/pull/**/files*').length > 0 || filterGlob([location.href], '*://*githubprivate.com/**/pull/**/files*').length > 0;
  }

  function run() {
    if (!isPRPage()) {
      return;
    }

    if (document?.querySelector(`#${WIDGET_ID}`)) {
      return;
    }

    const toolbar = getPRToolbar();
    const globWidget = createGlobFilterWidget();
    toolbar.appendChild(globWidget);

    function getPRToolbar() {
      const toolbarContainer = document.querySelector('.pr-toolbar');
      const actions = toolbarContainer.querySelector('details');
      const toolbar = actions.parentNode;
      return toolbar;
    }
  
    function createGlobFilterWidget() {
      const widget = document.createElement('div');
      widget.id = WIDGET_ID;
      const title = document.createElement('strong');
      title.textContent = "Glob filter";
      title.style.marginLeft = "8px";
  
      const globInput = document.createElement('input');
      globInput.type = 'text';
      globInput.style.marginLeft = "8px";
  
      const submit = document.createElement('button');
      // Copying Github's class names
      submit.className = "btn btn-sm btn-primary";
      submit.textContent = "Run filter";
      submit.style.marginLeft = "8px";
  
      globInput.addEventListener('change', function() {
        globString = this.value;
      });
  
      submit.addEventListener('click', function() {
        /**
         * TODO:
         * 1. I think we can optimize this time complexity by using a dictionary.
         * 2. I can we think can support multiple glob pattern in one string, similar to vscode search by splitting the string by "," and run `filterGlob` on each splitted output.
         * Then we can merge the output filenames back together and remove duplicates by leveraging dictionary from 1). (e.g, globString = "globPattern1, globPattern2")
         */
        const changedFiles = [...getAllChangedFiles()];
        const changedFilenames = changedFiles.map(getFilename);
        const filteredFilenames = filterGlob(changedFilenames, globString);

        // We first, collapse everything. This is good for also handling  resetting the initial state when the filter changes.
        changedFiles.forEach(changedFile => {
          const button = getCollapseButton(changedFile);
          if (button.getAttribute('aria-expanded') === 'true') {
            button.click();
          }
        })
  
        // Get files that match the glob.
        const filteredFiles = changedFiles.filter(file => {
          const name = getFilename(file);
          return filteredFilenames.indexOf(name) >= 0;
        });
  
        filteredFiles.forEach(file => {
          const button = getCollapseButton(file);
  
          // If file is currently collapsed, click to expand it.
          if (button.getAttribute('aria-expanded') === 'false') {
            button.click();
          }
        })
      });
  
      widget.appendChild(title);
      widget.appendChild(globInput);
      widget.appendChild(submit);
      return widget;
    }
    
    function getFilename(fileDOM) {
      return fileDOM.querySelector('a').getAttribute('title');
    }
  
    function getAllChangedFiles() {
      const filesContainer = document.querySelector('#files');
      const files = filesContainer.querySelectorAll('[data-details-container-group]');
      return files;
    }
  
    function getCollapseButton(fileDOM) {
      return fileDOM.querySelector('button');
    }
  }
})();






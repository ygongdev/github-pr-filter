'use strict';

(async () => {
  const src = chrome.runtime.getURL("filterGlob-bundle.js");
  // Adds filterGlob to the global namespace;
  await import(src);

  /**
   * Globals
   */
  // Prevents toolbar creation from keep triggering mutation observer.
  const WIDGET_ID = 'glob-filter-widget';
  const STORAGE_KEY = 'github-pr-filter-saved-filters';

  // Because sometimes Github is changing page content and url without triggering a reload, so we need to use a mutation observer.
  // If the page reload, the whole content-script will be reloaded.
  const filterObserver = new MutationObserver(debounce(run, 500));
  filterObserver.observe(document.body, { childList: true, subtree: true });

  class Widget {
    widget;
    trigger;
    dropdown;
    filterGlobToggleDOM;
    filterRegexToggleDOM;
    filterType = "glob";
    filterInputDOM;
    filterRegexFlagsTitleDOM;
    filterRegexFlagsDOM;
    filterRegexFlags = "";
    filterValue = "";
    savedFiltersDOM;

    constructor() {
      this.widget = this.constructWidget();
      this.trigger = this.constructTrigger();
      this.dropdown = this.constructDropdown();
      this.widget.appendChild(this.trigger);
      this.widget.appendChild(this.dropdown);

      this.setupSavedFiltersListener();
    }
    
    constructGithubContainer() {
      const container = document.createElement('div');
      container.style.padding = "12px";
      container.style.borderBottom = "1px solid var(--color-select-menu-border-secondary)";

      return container;
    }

    constructWidget() {
      const widget = document.createElement('details');
      widget.className = "details-reset details-overlay diffbar-item toc-select select-menu ml-0 ml-sm-3"
      widget.id = WIDGET_ID;

      return widget;
    }

    constructTrigger() {
      const trigger = document.createElement('summary');
      trigger.className = "btn-link Link--muted select-menu-button";
      trigger.ariaHasPopup = "menu";
      trigger.role = "button";

      const text = document.createElement('strong');
      text.textContent = "Advanced Filter";
      trigger.appendChild(text);
      return trigger;
    }

    constructDropdown() {
      const dropdown = document.createElement('details-menu');
      dropdown.className = "select-menu-modal position-absolute";
      dropdown.style.zIndex = 99;
      dropdown.role = "menu";
      dropdown.preload = true;

      const header = this.constructHeader();
      const filterOptions = this.constructFilterOptions();
      const filterInput = this.constructFilterInput();
      const filterSubmit = this.constructFilterSubmit();
      const savedFilters = this.constructSavedFilters();

      dropdown.appendChild(header);
      dropdown.appendChild(filterOptions);
      dropdown.appendChild(filterInput);
      dropdown.appendChild(filterSubmit);
      dropdown.appendChild(savedFilters);

      return dropdown;
    }

    constructHeader() {
      const header = document.createElement('div');
      header.className = "select-menu-header";
      const text = document.createElement('span');
      text.className = "select-menu-title";
      text.textContent = "Filter changed files";
      header.appendChild(text);
      return header;
    }

    constructFilterOptions() {
      const container = this.constructGithubContainer();
      container.style.display = "flex";
      container.style.justifyContent = "space-around";

      const globContainer = document.createElement('div');
      const globToggle = document.createElement('input');
      globToggle.type = "radio";
      globToggle.id = "glob";
      globToggle.name = "filter-type";
      globToggle.value = "glob";
      globToggle.checked = true;
      globToggle.style.marginRight = '4px';
      globToggle.addEventListener('change', () => {
        this.filterType = "glob";
        this.resetFilterInput();
        this.filterRegexFlagsTitleDOM.style.display = "none";
        this.filterRegexFlagsDOM.style.display = "none";
      });
      this.filterGlobToggleDOM = globToggle;

      const globLabel = document.createElement('label');
      globLabel.for = 'glob';
      globLabel.textContent = 'Glob';

      globContainer.appendChild(globToggle);
      globContainer.appendChild(globLabel);

      const regexContainer = document.createElement('div');

      const regexToggle = document.createElement('input');
      regexToggle.type = "radio";
      regexToggle.id = "regex";
      regexToggle.name = "filter-type";
      regexToggle.value = "regex";
      regexToggle.style.marginRight = '4px';
      regexToggle.addEventListener('change', () => {
        this.filterType = "regex";
        this.resetFilterInput();
        this.filterRegexFlagsTitleDOM.style.display = "block";
        this.filterRegexFlagsDOM.style.display = "block";
      });
      this.filterRegexToggleDOM = regexToggle;

      const regexLabel = document.createElement('label');
      regexLabel.for = 'regex';
      regexLabel.textContent = 'Regex';

      regexContainer.appendChild(regexToggle);
      regexContainer.appendChild(regexLabel);
      
      container.appendChild(globContainer);
      container.appendChild(regexContainer);

      return container;
    }

    constructFilterInput() {
      const container = this.constructGithubContainer();
      container.style.display = "flex";
      container.style.justifyContent = "space-around";
      container.style.alignItems = "center";

      const filterInput = document.createElement('input');
      filterInput.type = 'text';
      filterInput.className = "form-control";
      filterInput.placeholder = "Filter changed files";
      filterInput.style.width = "100%";

      filterInput.addEventListener('change', () => {
        this.filterValue = filterInput.value;
      });

      this.filterInputDOM = filterInput;

      const flagsTitle = document.createElement('strong');
      flagsTitle.textContent = "Flags";
      flagsTitle.style.marginLeft = "8px";
      flagsTitle.style.marginRight = "4px";
      flagsTitle.style.display = "none";

      const filterRegexFlags = document.createElement('input');
      filterRegexFlags.type = 'text';
      filterRegexFlags.className = "form-control";
      filterRegexFlags.placeholder = "Regex flags";
      // hide on initial since glob is default.
      filterRegexFlags.style.display = "none";

      filterRegexFlags.addEventListener('change', () => {
        this.filterRegexFlags = filterRegexFlags.value;
      });

      this.filterRegexFlagsTitleDOM = flagsTitle;
      this.filterRegexFlagsDOM = filterRegexFlags;
  
      container.appendChild(filterInput);
      container.appendChild(flagsTitle);
      container.appendChild(filterRegexFlags);

      return container;
    }

    constructFilterSubmit() {
      const container = this.constructGithubContainer();

      const submit = document.createElement('button');
      // Copying Github's class names
      submit.className = "btn btn-lg btn-primary";
      submit.textContent = "Run filter";
      submit.style.width = "100%";

      submit.addEventListener('click', () => {
        this.filterFiles(this.filterType);
      });

      const savedFilterButton = this.constructSaveFilterButton();

      container.appendChild(savedFilterButton);
      container.appendChild(submit);
      return container;
    }

    constructSaveFilterButton() {
      const save = document.createElement('button');
      // Copying Github's class names
      save.className = "btn btn-lg";
      save.textContent = "Save Filter";
      save.style.width = "100%";
      save.style.backgroundColor = "blue";

      save.addEventListener('click', () => {
        this.saveFilter(); 
      });

      return save;
    }

    constructSavedFilters() {
      const container = document.createElement('div');
      const header = document.createElement('div');
      header.className = "select-menu-header";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "center";
      const text = document.createElement('span');
      text.className = "select-menu-title";
      text.textContent = "Saved filters (<name>|<value>|<flags>|<type>)";
      header.appendChild(text);

      const selection = document.createElement('div');
      selection.style.maxHeight = "300px";
      selection.style.overflow = "auto";

      container.appendChild(header);
      container.appendChild(selection);

      this.savedFiltersDOM = selection;

      this.updateSavedFilters(selection);

      return container;
    }

    updateSavedFilters(container) {
      let savedFiltersFragment = document.createDocumentFragment();

      chrome.storage.sync.get([ STORAGE_KEY ], (result) => {
        const savedFilters = result[STORAGE_KEY];

        if (!savedFilters || savedFilters.length <= 0) {
          container.innerHTML = "";
          return;
        }

        savedFilters.forEach(filter => {
          const savedFilter = document.createElement('div');
          savedFilter.className = "select-menu-item";
          savedFilter.role = "menuitem";
          savedFilter.style.display = "flex";
          savedFilter.style.justifyContent = "space-between";

          const metaContainer = document.createElement('div');
          metaContainer.style.display = "flex";

          const filterName = document.createElement('span');
          filterName.textContent = filter.name + ' | ';
          filterName.style.whiteSpace = "pre-wrap";
  
          const filterValue = document.createElement('span');
          filterValue.textContent = filter.value + ' | ';
          filterValue.style.whiteSpace = "pre-wrap";
  
          const filterType = document.createElement('span');
          filterType.textContent = filter.type;
          filterType.style.whiteSpace = "pre-wrap";

          metaContainer.appendChild(filterName);
          metaContainer.appendChild(filterValue);
          if (filter.flags) {
            const filterFlags = document.createElement('span');
            filterFlags.textContent = filter.flags + ' | ';
            filterFlags.style.whiteSpace = "pre-wrap";
            metaContainer.appendChild(filterFlags);
          }
          metaContainer.appendChild(filterType);

          const controlsContainer = document.createElement('div');
          controlsContainer.style.display = "flex";

          const applyButton = document.createElement('button');
          applyButton.className = "btn btn-sm btn-primary";
          applyButton.style.marginRight = "8px";
          applyButton.textContent = "Apply";

          const deleteButton = document.createElement('button');
          deleteButton.className = "btn btn-sm btn-danger";
          deleteButton.textContent = "Delete";
          
          applyButton.addEventListener('click', () => {
            this.applySavedFilter(filter);
          });

          deleteButton.addEventListener('click', () => {
            this.deleteSavedFilter(filter.name);
          });

          controlsContainer.appendChild(applyButton);
          controlsContainer.appendChild(deleteButton);

          savedFilter.appendChild(metaContainer);
          savedFilter.appendChild(controlsContainer);

          savedFiltersFragment.appendChild(savedFilter);
        });
        container.innerHTML = "";
        container.appendChild(savedFiltersFragment)
      });
    }

    /**
     * Switch toggle to the right type, hopefully that resets everything.
     * Replace filter input value;
     */
    applySavedFilter({ value, type, flags}) {
      switch (type) {
        case "glob":
          this.filterGlobToggleDOM.click();
          this.filterInputDOM.value = value;
          this.filterValue = value;
          break;
        case "regex":
          this.filterRegexToggleDOM.click();
          this.filterInputDOM.value = value;
          this.filterValue = value;
          this.filterRegexFlagsDOM.value = flags;
          this.filterRegexFlags = flags;
          break;
        default:
          window.alert('Apply failed');
          break;
      }
    } 

    deleteSavedFilter(name) {
      if (window.confirm(`Are you sure you want to delete ${name}`)) {
        chrome.storage.sync.get([ STORAGE_KEY ] , (result) => {
          const savedFilters = result[STORAGE_KEY];
          const index = savedFilters.findIndex((filter) => filter.name === name);
          savedFilters.splice(index, 1);
        
          chrome.storage.sync.set({ [STORAGE_KEY]: [ ...savedFilters ]});
        });
      }
    }

    saveFilter() {
      if (!this.filterValue) {
        window.alert('No value provided. Saved failed');
        return;
      }

      const name = window.prompt('Enter a name for this filter');

      if (!name) {
        window.alert("No name provided. Save failed");
        return;
      }

      chrome.storage.sync.get([ STORAGE_KEY ] , (result) => {
        const savedFilters = result[STORAGE_KEY];
        const newFilter = {
          name,
          value: this.filterValue,
          type: this.filterType,
          flags: this.filterRegexFlags,
        }
      
        if (!savedFilters) {
          chrome.storage.sync.set({ [STORAGE_KEY]: [ newFilter ]});
        } else {
          chrome.storage.sync.set({ [STORAGE_KEY]: [ ...savedFilters, newFilter ]});
        }
      });
    }

    resetFilterInput() {
      this.filterInputDOM.value = "";
      this.filterValue = "";
      this.filterRegexFlagsDOM.value = "";
      this.filterRegexFlags = "";
    }

    filterFiles(type) {
      let filteredFiles;

      try {
        const changedFiles = [...this._getAllChangedFiles()];

        switch(type) {
          case "regex":
            filteredFiles = this._filterByRegex(changedFiles);
            break;
          case "glob":
          default:
            filteredFiles = this._filterByGlob(changedFiles);
            break;
        }

        // We first, collapse everything. This is good for also handling  resetting the initial state when the filter changes.
        this._collapseFiles(changedFiles);
  
        filteredFiles.forEach(file => {
          const button = this._getCollapseButton(file);
  
          // If file is currently collapsed, click to expand it.
          if (button.getAttribute('aria-expanded') === 'false') {
            button.click();
          }
        });
      } catch (error) {
        window.alert(error);
      }
    }

    setupSavedFiltersListener() {
      chrome.storage.onChanged.addListener((changes) => {
        for (let [key, _] of Object.entries(changes)) {

          if (key === STORAGE_KEY) {
            this.updateSavedFilters(this.savedFiltersDOM);
          }
        }
      });
    }

    /**
     * TODO:
     * 1. I think we can optimize this time complexity by using a dictionary.
     * 2. I can we think can support multiple glob pattern in one string, similar to vscode search by splitting the string by "," and run `filterGlob` on each splitted output.
     * Then we can merge the output filenames back together and remove duplicates by leveraging dictionary from 1). (e.g, globString = "globPattern1, globPattern2")
     */
    _filterByGlob(changedFiles) {
      const changedFilenames = changedFiles.map(this._getFilename);
      const filteredFilenames = filterGlob(changedFilenames, this.filterValue);

      // Get files that match the glob.
      const filteredFiles = changedFiles.filter(file => {
        const name = this._getFilename(file);
        return filteredFilenames.indexOf(name) >= 0;
      });

      return filteredFiles;
    }

    _filterByRegex(changedFiles) {
      const changedFilenames = changedFiles.map(this._getFilename);

      // TODO: Implement a way to allow user to change regex flag.
      const re = this.filterRegexFlags ? new RegExp(this.filterValue, this.filterRegexFlags) : new RegExp(this.filterValue);
      const filteredFilenames = changedFilenames.filter(filename => re.test(filename));

      // Get files that match the glob.
      const filteredFiles = changedFiles.filter(file => {
        const name = this._getFilename(file);
        return filteredFilenames.indexOf(name) >= 0;
      });

      return filteredFiles;
    }

    _collapseFiles(changedFiles) {
      changedFiles.forEach(changedFile => {
        const button = this._getCollapseButton(changedFile);
        if (button.getAttribute('aria-expanded') === 'true') {
          button.click();
        }
      })
    }

    _getFilename(fileDOM) {
      return fileDOM.querySelector('a').getAttribute('title');
    }
  
    _getAllChangedFiles() {
      const filesContainer = document.querySelector('#files');
      const files = filesContainer.querySelectorAll('[data-details-container-group]');
      return files;
    }
  
    _getCollapseButton(fileDOM) {
      return fileDOM.querySelector('button');
    }
  }
  
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
    const widget = new Widget();
    toolbar.appendChild(widget.widget);

    function getPRToolbar() {
      const toolbarContainer = document.querySelector('.pr-toolbar');
      const actions = toolbarContainer.querySelector('details');
      const toolbar = actions.parentNode;
      return toolbar;
    }
  }

  run();
})();






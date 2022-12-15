//-------------------------------//
// CONSTANTS
//-------------------------------//

const SITE_URL = 'https://view-it.toolforge.org/';
// const SITE_URL = 'http://localhost:3000/';
const IMG_WIDTH = '320';
const IMG_HEIGHT = '200';
const NUM_RESULTS = 20;
const USER_AGENT = 'View-it! [In Development] (https://view-it.toolforge.org/)';
const ORIGIN = '*';

// Flags:
const toggleRemoveClaim = false;

// Return if value is integer:
function isInt(value) {
  return !isNaN(value) &&
    parseInt(Number(value)) == value &&
    !isNaN(parseInt(value, 10));
}

// Initiate a search from the form:
function searchFromForm() {
  let url = new URL(document.baseURI);
  let returnTo = url.searchParams.get("returnTo");
  url = new URL(document.baseURI.split('?')[0]);
  const formElements = document.querySelectorAll('#searchForm input[type="search"], #searchForm select');
  formElements.forEach((element) => {
    if (element.value !== '') {
      url.searchParams.append(element.name, element.value);
    }
  });
  if (returnTo) {
    url.searchParams.append('returnTo', returnTo);
  }

  if (url.searchParams.get('q')) {
    window.location.href = url;
  } else {
    displayError('You have not provided a Q-number!');
  }

  return false;
}

// Initiate search:
function startSearch() {
  // Hide any existing existing error messages
  hideError();

  // Gather window and URL params
  let url = new URL(window.location.href);
  let qNum = url.searchParams.get("q");
  let returnTo = url.searchParams.get("returnTo");

  let property = url.searchParams.get("property");
  document.getElementById('property').value = property || '';
  let assessment = url.searchParams.get("assessment");
  document.getElementById('assessment').value = assessment || '';
  let resolution = url.searchParams.get("resolution");
  document.getElementById('resolution').value = resolution || '';
  let freetext = url.searchParams.get("freetext");
  document.getElementById('freetext').value = freetext || '';
  let category = url.searchParams.get("category");
  if (category) {
    category = category.replace('Category:', '');
  }

  if (property || assessment || resolution || freetext) {
    toggleAdvancedSearch(true);
  }

  if (qNum) {
    qNum = qNum.toUpperCase();
    document.getElementById('qNumberInput').value = qNum;
    if (isInt(qNum)) {
      qNum = 'Q' + qNum;
    }
    if (qNum.substring(0, 1) === 'Q' && isInt(qNum.substring(1))) {
      generateHeader(qNum, returnTo);

      let offset = 0;
      getImages(qNum, offset);
    } else {
      displayError(qNum + ' is not a valid Q-number.');
    }
  }
}

// Display an error in the DOM:
function displayError(error) {
  document.getElementById('error').style.display = 'block';
  document.getElementById('error').innerHTML = '<br />' + error;
}

// Hide error in DOM:
function hideError() {
  document.getElementById('error').style.display = 'none';
}

// Generate header above results (show Q-number, label, number of results, and return-to-article button):
function generateHeader(qNum, returnTo) {
  if (qNum && isInt(qNum.substring(1))) {
    document.getElementById('results').style.display = 'block';

    // Adjust results header
    let resultsHeaderLink = document.getElementById('resultsHeaderLink');
    resultsHeaderLink.href = 'https://www.wikidata.org/wiki/' + qNum;
    resultsHeaderLink.innerHTML = qNum;

    // Get Q-number details
    fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' + qNum + '&props=labels&languages=en&format=json&origin=' + ORIGIN, {
      method: 'GET',
      headers: new Headers({
        'Api-User-Agent': USER_AGENT
      })
    }).then((response) => response.json())
      .then((data) => {
        const label = data['entities']['' + qNum]['labels']['en']['value'];
        const resultsHeader = document.getElementById('imagesDepicting');
        let url = new URL(window.location.href);
        let category = url.searchParams.get("category");
        let property = url.searchParams.get("property");
        let imagesLabel = '';
        if (category) {
          category = category.replace('Category:', '');
          resultsHeader.innerHTML = 'Images in Commons category <a href="https://commons.wikimedia.org/wiki/Category:' + category + '" target="_blank">' + category + '</a>';
        }
        else {
          switch (property) {
            case 'depicts':
              imagesLabel = 'Images depicting';
              break;
            case 'main':
              imagesLabel = 'Images with main subject';
              break;
            case 'creator':
              imagesLabel = 'Images created by';
              break;
            case 'category':
              imagesLabel = 'Images in Commons category for';
              break;
            default:
              imagesLabel = 'Images depicting or linked from';
          }
          resultsHeader.innerHTML = imagesLabel + ' <a href="https://www.wikidata.org/wiki/' + qNum + '" target="_blank">' + qNum + '</a> (' + label + ')';
        }
      }).catch((error) => {
        console.error('Error ', error);
      });;

    // Show "back to article" button
    if (returnTo) {
      let returnToLink = document.getElementById('returnToLink');
      returnToLink.href = returnTo;
      returnToLink.style.display = 'block';
    }
  }
}

// Make a call to View it! API to get images:
function getImages(qNum, offset) {
  let url = new URL(window.location.href);
  const fetchImagesURL = new URL(SITE_URL + 'api/' + qNum);
  if (url.searchParams.get("property")) {
    fetchImagesURL.searchParams.append('property', url.searchParams.get("property"));
  }
  if (url.searchParams.get("assessment")) {
    fetchImagesURL.searchParams.append('assessment', url.searchParams.get("assessment"));
  }
  if (url.searchParams.get("resolution")) {
    fetchImagesURL.searchParams.append('resolution', url.searchParams.get("resolution"));
  }
  if (url.searchParams.get("freetext")) {
    fetchImagesURL.searchParams.append('freetext', url.searchParams.get("freetext"));
  }
  if (url.searchParams.get("category")) {
    fetchImagesURL.searchParams.append('category', url.searchParams.get("category").replace('Category:', ''));
  }
  if (offset) {
    fetchImagesURL.searchParams.append('offset', offset);
  }
  fetch(fetchImagesURL, {
    method: 'GET',
    headers: new Headers({
      'Api-User-Agent': USER_AGENT,
      'Content-Type': 'application/json'
    })
  }).then((response) => response.json())
    .then((data) => {
      let numResults = data.total;

      // Show number of results on DOM:
      const resultsHeaderResults = document.getElementById('numResults');
      resultsHeaderResults.innerHTML = numResults.toLocaleString();

      // Check if no results
      if (numResults > 0) {
        // Remove pagination button, if it exists
        const existingPaginationButton = document.getElementById('paginationButton');
        if (existingPaginationButton) {
          existingPaginationButton.remove();
        }

        // Output images
        const resultsElement = document.getElementById('results');
        resultsElement.style.display = 'block';

        let images = [];
        let results = data.results;
        results.forEach((image) => {
          images.push({
            'page': image.image,
            'name': image.title,
            'thumb': image.thumb,
            'width': image.width,
            'height': image.height
          });
        });

        // Display images on DOM
        images.forEach((image) => {
          const container = document.createElement('div');
          container.classList.add('imageContainer');
          let ratio = IMG_HEIGHT / image.height;
          container.style.width = (image.width * ratio) + 'px';

          const a = document.createElement('a');
          a.href = image.page;
          a.title = image.name;
          a.target = '_blank';

          let img = document.createElement('img');
          img.src = image.thumb;

          let captionBottom = document.createElement('div');
          captionBottom.classList.add('caption');
          captionBottom.classList.add('caption-bottom');
          captionBottom.innerHTML = image.name;

          a.appendChild(img);
          container.appendChild(a);

          if (toggleRemoveClaim) {
            const property = url.searchParams.get("property");
            if (property == 'depicts' ||
              property == 'main' ||
              property == 'creator') {
              let captionTop = document.createElement('div');
              captionTop.classList.add('caption');
              captionTop.classList.add('caption-top');
              captionTop.classList.add('align-right');
              let removeStatementLink = document.createElement('span');
              removeStatementLink.innerHTML = 'Remove statement';
              removeStatementLink.addEventListener("click", function () { removeStatement(image.name, property); });
              captionTop.appendChild(removeStatementLink);
              container.appendChild(captionTop);
            }
          }

          container.appendChild(captionBottom);
          resultsElement.appendChild(container);
        });

        // Output pagination button as needed
        if (numResults > (offset + NUM_RESULTS)) {
          offset += 20;

          const resultsContainer = document.getElementById('results');
          function scrollListener(e) {
            var elementOffset = resultsContainer.getBoundingClientRect().top - resultsContainer.offsetParent.getBoundingClientRect().top;
            const top = window.pageYOffset + window.innerHeight - elementOffset;
            if (top > resultsContainer.scrollHeight) {
              window.removeEventListener('scroll', scrollListener);
              getImages(qNum, offset);
            }
          }
          window.addEventListener("scroll", scrollListener, { passive: false });
        }
      }

      // Output subcategories for category search
      const subcats = data.subcategories;
      if (subcats && subcats.length > 0) {
        const subcatsContainer = document.getElementById('subcategoriesList');
        subcats.forEach((subcat) => {
          const linkText = document.createTextNode(subcat.replace('Category:', ''));
          const div = document.createElement('div');
          const a = document.createElement('a');
          a.appendChild(linkText);
          a.title = subcat.replace('Category:', '');
          let url = new URL(window.location.href);
          url.searchParams.set('category', subcat);
          a.href = url;
          div.appendChild(a);
          subcatsContainer.appendChild(div);
        });
        document.getElementById('subcategories').style.display = 'block';
      } else {
        document.getElementById('subcategories').style.display = 'none';
      }
    }).catch((error) => {
      console.error('Error ', error);
    });;
}

function getSubcategoryImages(category) {
  const fetchImagesURL = new URL(SITE_URL + 'api/' + qNum);
}

function toggleAdvancedSearch(toggled) {
  const advancedSearchToggle = document.getElementById('toggleAdvancedSearch');
  const advancedElements = document.querySelectorAll('.advanced');
  advancedElements.forEach((element) => {
    if (toggled) {
      localStorage.setItem('view-it-advanced-search', true);
      advancedSearchToggle.checked = true;
      element.style = "display: inline-block";
    } else {
      localStorage.setItem('view-it-advanced-search', false);
      advancedSearchToggle.checked = false;
      element.style = "display: none";
      document.getElementById('property').value = '';
      document.getElementById('assessment').value = '';
      document.getElementById('resolution').value = '';
      document.getElementById('freetext').value = '';
    }
  });
}

function removeStatement(image, propertyName) {
  let property = '';
  switch (propertyName) {
    case 'depicts':
      property = 'P180'
      break;
    case 'main':
      property = 'P921'
      break;
    case 'creator':
      property = 'P170'
      break;
  }

  if (confirm('Would you like to remove the ' + propertyName + ' statement (' + property + ') from ' + image + '?') === true) {
    // Make a call to View it! API to remove statement:
    const removeStatementURL = new URL(SITE_URL + 'remove');
    removeStatementURL.searchParams.append('file', image);
    removeStatementURL.searchParams.append('property', property);
    fetch(removeStatementURL, {
      method: 'GET',
      headers: new Headers({
        'Api-User-Agent': USER_AGENT,
        'Content-Type': 'application/json'
      })
    }).then((response) => response.json())
      .then((data) => {
        console.log(data);
      }).catch((error) => {
        console.error('Error ', error);
      });
  }
}

window.onload = function () {
  let url = new URL(window.location.href);
  let qNum = url.searchParams.get("q");
  if (!qNum) {
    document.getElementById('splashContainer').style.display = 'grid';
    document.getElementById('searchAccordion').checked = true;
  } else {
    document.getElementById('splashContainer').style.display = 'none';
  }

  startSearch();

  // Clear subcategories section:
  document.getElementById('subcategories').style.display = 'none';

  // Open search accordion if it was open on last use:
  let searchAccordionSetting = localStorage.getItem('view-it-search-accordion');
  if (searchAccordionSetting === null) {
    localStorage.setItem('view-it-search-accordion', 'closed');
    searchAccordionSetting = 'closed';
  }
  if (searchAccordionSetting === 'open') {
    document.getElementById('searchAccordion').checked = true;
  }

  // Set advanced search to hidden or visible based on user preference:
  let advancedSearchSetting = localStorage.getItem('view-it-advanced-search');
  if (advancedSearchSetting === null) {
    localStorage.setItem('view-it-advanced-search', 'false');
    advancedSearchSetting = 'false';
  }
  if (advancedSearchSetting === 'true') {
    toggleAdvancedSearch(true);
  } else {
    toggleAdvancedSearch(false);
  }

  // Listen for search accordion toggle:
  const searchAccordion = document.getElementById('searchAccordion');
  searchAccordion.addEventListener('click', function (event) {
    if (event.target.checked) {
      localStorage.setItem('view-it-search-accordion', 'open');
    } else {
      localStorage.setItem('view-it-search-accordion', 'closed');
    }
  }, false);

  // Listen for advanced search toggle
  const advancedSearchToggle = document.getElementById('toggleAdvancedSearch');
  advancedSearchToggle.addEventListener('click', function (event) {
    if (event.target.checked) {
      toggleAdvancedSearch(true);
    } else {
      toggleAdvancedSearch(false);
    }
  }, false);

  // Listen for subcategories toggle
  const subcategoriesList = document.getElementById('subcategoriesList');
  subcategoriesList.style.display = 'none';
  const subcategoriesToggle = document.getElementById('toggleSubcategories');
  subcategoriesToggle.addEventListener('click', function (event) {
    if (subcategoriesList.style.display === 'none') {
      subcategoriesList.style.display = 'inline-block';
      subcategoriesToggle.innerHTML = 'Hide subcategories';
    } else {
      subcategoriesList.style.display = 'none';
      subcategoriesToggle.innerHTML = 'View subcategories';
    }
  });
}
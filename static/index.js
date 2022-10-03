//-------------------------------//
// CONSTANTS
//-------------------------------//

const SITE_URL = 'https://view-it.toolforge.org/';
const IMG_WIDTH = '320';
const IMG_HEIGHT = '200';
const NUM_RESULTS = 20;
const USER_AGENT = 'View-it! [In Development] (https://view-it.toolforge.org/)';
const ORIGIN = '*';

// Filters:
const FILTER_DEPICTS_OR_LINKED = 'custommatch:depicts_or_linked_from=';
const FILTER_DEPICTS = 'haswbstatement:P180=';
const FILTER_MAIN_SUBJECT = 'haswbstatement:P921=';
const FILTER_CREATOR = 'haswbstatement:P170=';
const FILTER_QUALITY = 'haswbstatement:P6731=Q63348069';
const FILTER_VALUED = 'haswbstatement:P6731=Q63348040';
const FILTER_FEATURED = 'haswbstatement:P6731=Q63348049';
const FILTER_SMALL = 'fileres:<500';
const FILTER_MEDIUM = 'fileres:500,1000';
const FILTER_LARGE = 'fileres:>1000';

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

// Build URL parameters from selected filters:
function applyFilters(qNum) {
  let filterString = '';
  let url = new URL(window.location.href);

  // Property
  let property = url.searchParams.get("property");
  switch (property) {
    case 'depicts':
      filterString += ' ' + FILTER_DEPICTS + qNum;
      break;
    case 'main':
      filterString += ' ' + FILTER_MAIN_SUBJECT + qNum;
      break;
    case 'creator':
      filterString += ' ' + FILTER_CREATOR + qNum;
      break;
    default:
      filterString += ' ' + FILTER_DEPICTS_OR_LINKED + qNum;
  }

  // Resolution
  let resolution = url.searchParams.get("resolution");
  if (resolution) {
    switch (resolution) {
      case 'small':
        filterString += ' ' + FILTER_SMALL;
        break;
      case 'medium':
        filterString += ' ' + FILTER_MEDIUM;
        break;
      case 'large':
        filterString += ' ' + FILTER_LARGE;
        break;
      default:
    }
  }

  // Assessment
  let assessment = url.searchParams.get("assessment");
  if (assessment) {
    switch (assessment) {
      case 'featured':
        filterString += ' ' + FILTER_FEATURED;
        break;
      case 'quality':
        filterString += ' ' + FILTER_QUALITY;
        break;
      case 'valued':
        filterString += ' ' + FILTER_VALUED;
        break;
      default:
    }
  }

  // Free text:
  let freetext = url.searchParams.get("freetext");
  if (freetext) {
    filterString += ' ' + freetext;
  }

  return filterString;
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
        let property = url.searchParams.get("property");
        let imagesLabel = '';
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
          default:
            imagesLabel = 'Images depicting or linked from';
        }
        resultsHeader.innerHTML = imagesLabel + ' <a href="https://www.wikidata.org/wiki/' + qNum + '" target="_blank">' + qNum + '</a> (' + label + ')';
      });

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
  const fetchImagesURL = new URL('https://view-it.toolforge.org/api/' + qNum);
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
          console.log(image);
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
          container.appendChild(captionBottom);

          resultsElement.appendChild(container);
        });

        // Output pagination button as needed
        if (numResults > (offset + NUM_RESULTS)) {
          offset += 20;
          const paginationButton = document.createElement('button');
          paginationButton.id = 'paginationButton';
          paginationButton.addEventListener("click", function () { getImages(qNum, offset) });
          paginationButton.innerHTML = 'Load more images...';
          resultsElement.appendChild(paginationButton);
        }
      }
    });
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

window.onload = function () {
  startSearch();

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

  // Listen for advanced search toggle
  const advancedSearchToggle = document.getElementById('toggleAdvancedSearch');
  advancedSearchToggle.addEventListener('click', function (event) {
    if (event.target.checked) {
      toggleAdvancedSearch(true);
    } else {
      toggleAdvancedSearch(false);
    }
  }, false);
}
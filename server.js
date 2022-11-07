/* eslint-env node, es6 */

const fetch = require('node-fetch');
const express = require('express');
session = require("express-session");
passport = require("passport");
MediaWikiStrategy = require("passport-mediawiki-oauth").OAuthStrategy;
config = require("./config");

const app = express();
const port = parseInt(process.env.PORT, 10);

app.use(passport.initialize());
app.use(passport.session());
app.use(session({
  secret: "OAuth Session",
  saveUninitialized: true,
  resave: true
}));

passport.use(
  new MediaWikiStrategy({
    consumerKey: config.consumer_key,
    consumerSecret: config.consumer_secret
  },
    function (token, tokenSecret, profile, done) {
      profile.oauth = {
        consumer_key: config.consumer_key,
        consumer_secret: config.consumer_secret
      };
      return done(null, profile);
    }
  ));
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

// Constants:
const LIMIT = 19;
const USER_AGENT = 'View-it! (https://view-it.toolforge.org/)';
const ORIGIN = '*';
const IMG_WIDTH = '320';
const IMG_HEIGHT = '200';
const FILTER_DEPICTS_OR_LINKED = 'custommatch:depicts_or_linked_from=';
const FILTER_DEPICTS = 'haswbstatement:P180=';
const FILTER_MAIN_SUBJECT = 'haswbstatement:P921=';
const FILTER_CREATOR = 'haswbstatement:P170=';
const FILTER_CATEGORY = 'incategory:';
const FILTER_QUALITY = 'haswbstatement:P6731=Q63348069';
const FILTER_VALUED = 'haswbstatement:P6731=Q63348040';
const FILTER_FEATURED = 'haswbstatement:P6731=Q63348049';
const FILTER_SMALL = 'fileres:<500';
const FILTER_MEDIUM = 'fileres:500,1000';
const FILTER_LARGE = 'fileres:>1000';

(async function () {

  // Logging:
  app.get(['/', '/test', '/api/:qNum'], (req, res, next) => {
    const timestamp = Date();
    console.log('===========================');
    console.log('Request at ' + timestamp + ':');
    try {
      console.log('User agent: ' + req.headers['user-agent']);
    } catch (err) {
      console.log('User agent: Unknown');
    }
    try {
      console.log('Path name: ' + req._parsedUrl.pathname);
    } catch (err) {
      console.log('Path name: Unknown');
    }
    try {
      console.log('Query: ' + req._parsedUrl.query);
    } catch (err) {
      console.log('Query: Unknown');
    }
    next();
  });

  // Authentication:
  app.get("/login", function (req, res) {
    res.redirect(req.baseUrl + "/auth/mediawiki/callback");
  });
  app.get("/auth/mediawiki/callback", function (req, res, next) {
    passport.authenticate("mediawiki", function (err, user) {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.redirect(req.baseUrl + "/login");
      }
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        req.session.user = user;
        res.redirect(req.baseUrl + "/");
        console.log(user);
      });
    })(req, res, next);
  });
  app.get( "/logout" , function ( req, res ) {
    delete req.session.user;
    res.redirect( req.baseUrl + "/" );
  } );


  // API endpoint:
  app.get('/api/:qNum', async (req, res) => {
    const qNum = req.params.qNum;
    const offset = req.query.offset || 0;

    // Create response object:
    let returnBody = {
      total: 0,
      results: []
    }

    // BUILT FILTER STRING
    let filterString = '';

    // Filter by Wkidata property:
    if (req.query.category) {
      let category = req.query.category.replace('Category:', '');
      filterString += ' ' + FILTER_CATEGORY + '"' + category + '"';

      // Get list of subcategories:
      const categoryPromise = new Promise(function (resolve, reject) {
        fetch('https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&format=json&cmtype=subcat&cmlimit=500&cmtitle=Category:' + category, {
          method: 'GET',
          headers: {
            'Api-User-Agent': USER_AGENT
          }
        }).then((response) => response.json())
          .then((data) => {
            const subcats = data['query']['categorymembers'].map(cat => cat.title);
            returnBody['subcategories'] = subcats;
            resolve();
          }).catch((error) => {
            console.error('Error ', error);
            returnBody['error'] = error;
            resolve();
          });
      });
      await categoryPromise;
    } else {
      switch (req.query.property) {
        case 'depicts':
          filterString += ' ' + FILTER_DEPICTS + qNum;
          break;
        case 'main':
          filterString += ' ' + FILTER_MAIN_SUBJECT + qNum;
          break;
        case 'creator':
          filterString += ' ' + FILTER_CREATOR + qNum;
          break;
        case 'category':
          const categoryPromise = new Promise(function (resolve, reject) {
            fetch('https://www.wikidata.org/w/api.php?action=wbgetclaims&property=P373&format=json&entity=' + qNum, {
              method: 'GET',
              headers: {
                'Api-User-Agent': USER_AGENT
              }
            }).then((response) => response.json())
              .then((data) => {
                if (Object.keys(data['claims']).length === 0) {
                  returnBody['error'] = 'No corresponding category could be found ' + qNum;
                  res.json(returnBody);
                } else {
                  const category = data['claims']['P373'][0]['mainsnak']['datavalue']['value'];
                  filterString += ' ' + FILTER_CATEGORY + '"' + category + '"';

                  // Get list of subcategories:
                  fetch('https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&format=json&cmtype=subcat&cmlimit=500&cmtitle=Category:' + category, {
                    method: 'GET',
                    headers: {
                      'Api-User-Agent': USER_AGENT
                    }
                  }).then((response) => response.json())
                    .then((data) => {
                      const subcats = data['query']['categorymembers'].map(cat => cat.title);
                      returnBody['subcategories'] = subcats;
                      resolve();
                    }).catch((error) => {
                      console.error('Error ', error);
                      returnBody['error'] = error;
                      resolve();
                    });
                }
              }).catch((error) => {
                console.error('Error ', error);
                returnBody['error'] = error;
                resolve();
              });
          });
          await categoryPromise;
          break;
        default:
          filterString += ' ' + FILTER_DEPICTS_OR_LINKED + qNum;
      }
    }

    // Filter by resolution
    switch (req.query.resolution) {
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
    // Filter by assessment
    switch (req.query.assessment) {
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

    // Free-text search:
    if (req.query.freetext) {
      filterString += ' ' + req.query.freetext;
    }

    // Query Commons API for image titles
    const fetchImagesURL = new URL('https://commons.wikimedia.org/w/api.php');
    fetchImagesURL.searchParams.append('action', 'query');
    fetchImagesURL.searchParams.append('cirrusDumpResult', 'true');
    fetchImagesURL.searchParams.append('format', 'json');
    fetchImagesURL.searchParams.append('generator', 'search');
    fetchImagesURL.searchParams.append('gsrlimit', LIMIT);
    fetchImagesURL.searchParams.append('gsrnamespace', '6');
    fetchImagesURL.searchParams.append('gsroffset', offset);
    fetchImagesURL.searchParams.append('gsrsearch', 'filetype:bitmap|drawing -fileres:0 ' + filterString);
    fetchImagesURL.searchParams.append('origin', ORIGIN);

    fetch(fetchImagesURL, {
      method: 'GET',
      headers: {
        'Api-User-Agent': USER_AGENT
      }
    }).then((response) => response.json())
      .then((data) => {
        // Store number of results:
        const numResults = data['__main__']['result']['hits']['total']['value'];

        // Check if no results
        if (numResults > 0) {
          returnBody['total'] = numResults;

          // Built pipe-separated string of image titles
          let imageTitlesArray = [];
          returnedImages = data['__main__']['result']['hits']['hits'];
          for (let i = 0; i < returnedImages.length; i++) {
            imageTitlesArray.push('File:' + returnedImages[i]['_source']['title']);
          }
          let imageTitlesStr = imageTitlesArray.join('|').replace(/ /g, "_");

          // Fetch thumbnails
          const fetchThumbnailsURL = new URL("https://commons.wikimedia.org/w/api.php")
          fetchThumbnailsURL.searchParams.append("action", "query");
          fetchThumbnailsURL.searchParams.append("format", "json");
          fetchThumbnailsURL.searchParams.append("iiprop", "url");
          fetchThumbnailsURL.searchParams.append("iiurlwidth", IMG_WIDTH);
          fetchThumbnailsURL.searchParams.append("origin", ORIGIN);
          fetchThumbnailsURL.searchParams.append("prop", "imageinfo");
          fetchThumbnailsURL.searchParams.append("titles", imageTitlesStr);

          fetch(fetchThumbnailsURL, {
            method: 'GET',
            headers: {
              'Api-User-Agent': USER_AGENT
            }
          }).then((response) => response.json())
            .then((data) => {
              let pages = data['query']['pages'];

              for (const image in pages) {
                returnBody.results.push({
                  'image': pages[image]['imageinfo']['0']['descriptionurl'],
                  'thumb': pages[image]['imageinfo']['0']['thumburl'],
                  'title': pages[image]['title'].replace('File:', ''),
                  'width': pages[image]['imageinfo']['0']['thumbwidth'],
                  'height': pages[image]['imageinfo']['0']['thumbheight']
                })
              }

              res.json(returnBody);
            }).catch((error) => {
              console.error('Error: ', error);
              returnBody['error'] = error;
            });
        } else {
          res.json(returnBody);
        }
      }).catch((error) => {
        console.error('Error ', error);
        returnBody['error'] = error;
      });
  });

  // Serve static pages in static directory:
  app.use(express.static('static'));

  app.listen(port, () => console.log(`View it! listening at port ${port}`));

})();

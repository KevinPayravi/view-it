/* eslint-env node, es6 */

const express = require('express');
// const axios = require('axios');
// const ax = axios.create({
//   withCredentials: true,
//   responseType: 'json'
// });
// ax.defaults.withCredentials = true;
const oauthFetch = require('oauth-fetch-json');
const OAuth = require("oauth");
fetch = require('node-fetch');
session = require("express-session");
passport = require("passport");
MediaWikiStrategy = require("passport-mediawiki-oauth").OAuthStrategy;
config = require("./config");

const app = express();
const port = parseInt(process.env.PORT, 10);

app.use(session({
  secret: config.consumer_secret,
  cookie: {
    // 7 days
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  resave: true,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new MediaWikiStrategy({
    consumerKey: config.consumer_key,
    consumerSecret: config.consumer_secret,
    baseURL: 'https://commons.wikimedia.org/',
    callbackURL: 'https://view-it.toolforge.org/auth/mediawiki/callback'
  },
    function (token, tokenSecret, profile, done) {
      profile.oauth = {
        consumer_key: config.consumer_key,
        consumer_secret: config.consumer_secret,
        token,
        token_secret: tokenSecret
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
  app.get('/login', passport.authenticate('mediawiki'));
  app.get('/auth/mediawiki/callback',
    passport.authenticate('mediawiki', { failureRedirect: '/login' }),
    function (req, res) {
      res.redirect('/');
    });

  app.get("/logout", function (req, res) {
    delete req.session.user;
    res.redirect(req.baseUrl + "/");
  });

  app.get('/remove', async (req, res) => {
    let session = req.session;
    let oauth_token = req.session['oauth:mediawiki'].oauth_token;
    let oauth_secret = req.session['oauth:mediawiki'].oauth_token_secret;
    let file = req.query.file;
    let property = req.query.property;

    // Get ID of claim to remove:
    let claimID = '';
    const claimPromise = new Promise(function (resolve, reject) {
      // Get list of entites for given file:
      let getEntitiesURL = new URL('https://commons.wikimedia.org/w/api.php');
      getEntitiesURL.searchParams.append('action', 'wbgetentities');
      getEntitiesURL.searchParams.append('format', 'json');
      getEntitiesURL.searchParams.append('sites', 'commonswiki');
      getEntitiesURL.searchParams.append('titles', 'File:' + file);
      getEntitiesURL.searchParams.append('props', '');
      getEntitiesURL.searchParams.append('formatversion', '2');

      fetch(getEntitiesURL.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Api-User-Agent': USER_AGENT
        }
      }).then((response) => response.json())
        .then((data) => {
          mNumber = Object.keys(data.entities)[0];

          // Get list of claims:
          let getClaimsURL = new URL('https://commons.wikimedia.org/w/api.php');
          getClaimsURL.searchParams.append('action', 'wbgetclaims');
          getClaimsURL.searchParams.append('format', 'json');
          getClaimsURL.searchParams.append('entity', mNumber);
          getClaimsURL.searchParams.append('property', property);
          getClaimsURL.searchParams.append('props', '');
          getClaimsURL.searchParams.append('formatversion', '2');
          fetch(getClaimsURL.toString(), {
            method: 'GET',
            headers: {
              'User-Agent': USER_AGENT,
              'Api-User-Agent': USER_AGENT
            }
          }).then((response) => response.json())
            .then((data) => {
              // Filter for desired claim ID:
              claimID = data.claims[Object.keys(data.claims)[0]].filter(element => element.mainsnak.property === property)[0].id;
              resolve();
            }).catch((error) => {
              console.error('Error ', error);
              reject();
            });
        }).catch((error) => {
          console.error('Error ', error);
          reject();
        });
    });
    await claimPromise;

    // Get CSRF token:
    oauthFetch('https://commons.wikimedia.org/w/api.php',
      {
        action: 'query',
        format: 'json',
        meta: 'tokens'
      },
      {},
      req.session).then(function (data) {
        console.log(data);
        token = data.query.tokens.csrftoken;

        // Remove claim:
        let removeClaimURL = new URL('https://commons.wikimedia.org/w/api.php');
        oauthFetch(removeClaimURL.toString(),
          {
            action: 'wbremoveclaims',
            claim: claimID,
            'format': 'json'
          },
          {
            token: token,
            method: 'POST'
          },
          req.session).then(function (data) {
            console.log(data);
            res.setHeader('Content-Type', 'application/json');
            res.status(200);
            res.send(JSON.stringify(data));
          });
      });
  });

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
            'User-Agent': USER_AGENT,
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
                'User-Agent': USER_AGENT,
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
                      'User-Agent': USER_AGENT,
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

    fetch(fetchImagesURL.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
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

          fetch(fetchThumbnailsURL.toString(), {
            method: 'GET',
            headers: {
              'User-Agent': USER_AGENT,
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

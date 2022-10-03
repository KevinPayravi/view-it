# View it

View it! is a tool that shows Wikipedia readers and editors relevant Wikimedia Commons media depicting—or otherwise related to—the article they are reading. View our [documentation on Meta wiki](https://meta.wikimedia.org/wiki/View_it!_Tool) for more information.

The tool is in active develop. Frequent changes should be expected through at least the end of 2022.

This repository is for the code behind https://view-it.toolforge.org/. A [user script](https://meta.wikimedia.org/wiki/User:SuperHamster/view-it.js) is also available to add a portlet link to View it! when viewing articles across Wikimedia wikis.

## Installation
This is an Express JavaScript project.

To run locally:
```
export PORT=3000
npm install
node server.js
```

## Support
Questions, comments, and suggestions can be placed on our projects [Meta talk page](https://meta.wikimedia.org/wiki/Talk:View_it!_Tool).

Issues and tasks are tracked on [Phabricator](https://phabricator.wikimedia.org/project/view/6085/).
// purgecss.config.js
module.exports = {
  // These are the files PurgeCSS will scan for CSS class usage.
  content: ['public/index.html', 'public/js/**/*.js'],

  // This is the CSS file it will clean up.
  css: ['public/Style.css'],

  // This is a crucial list of classes to NEVER remove.
  // We use regular expressions (the text between /.../) to protect
  // all Font Awesome classes and our role-based visibility classes.
  safelist: [
    /^fa-/,
    /^fas$/,
    /^far$/,
    /^fab$/,
    /^(admin|manager)-only$/
  ]
}
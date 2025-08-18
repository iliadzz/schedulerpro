// purgecss.config.js
module.exports = {
  // These are the files PurgeCSS will scan for CSS class usage.
  content: ['public/index.html', 'public/js/**/*.js'],

  // This is the list of CSS files it will clean up.
  // We've added your new files here.
  css: [
    'public/Style.css',
    'public/css/login.css',
    'public/css/components.css'
  ],

  // This is a crucial list of classes to NEVER remove.
  // We use regular expressions to protect Font Awesome and role-based classes.
  safelist: [
    /^fa-/,
    /^fas$/,
    /^far$/,
    /^fab$/,
    /^(admin|manager)-only$/
  ],
  
  // This tells PurgeCSS where to put the cleaned files.
  // It's good practice to specify this directly in the config.
  output: 'purged_css'
}
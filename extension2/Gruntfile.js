module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-browserify')

  grunt.initConfig({
    browserify: {
      options: {
        debug: true
      },
      module: {
        files: {
          './extension/js/module.js': ['./lib/*.js']
        }
      },
    }
  })

  grunt.registerTask('default', ['browserify'])
}

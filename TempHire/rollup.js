import rollup      from 'rollup';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs    from 'rollup-plugin-commonjs';
import uglify      from 'rollup-plugin-uglify';
import replace     from 'rollup-plugin-replace';
import alias       from 'rollup-plugin-strict-alias';
import path        from 'path';

export default {
  entry: 'app/main.js',
  dest: 'dist/build.js', // output a single application bundle
  sourceMap: true,
  format: 'iife',
  plugins: [
      alias({
          'breeze-client': path.resolve(__dirname, 'node_modules', 'breeze-client/breeze.base.debug.js')
      }),
      nodeResolve({jsnext: true, module: true}),
      replace({
          'moduleId: module.id,': ''
      }),
      commonjs({
        include: [
            'node_modules/rxjs/**', 
            'node_modules/breeze-client/**', 
            'node_modules/breeze-bridge-angular/**', 
            'node_modules/lodash/**'
        ],
        exclude: [
            'node_modules/breeze-client/breeze.debug.js'
        ],
        namedExports: {
            'node_modules/breeze-client/breeze.base.debug.js': [
                'core',
                'config',
                'NamingConvention',
                'DataService',
                'EntityManager',
                'EntityQuery',
                'FetchStrategy',
                'SaveOptions',
                'Predicate', 
                'FilterQueryOp'
            ]
        }
      }),
      uglify()
  ]
}

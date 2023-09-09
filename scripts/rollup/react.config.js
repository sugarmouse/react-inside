import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils';

import generagtePackageJson from 'rollup-plugin-generate-package-json';

const { name, module } = getPackageJSON('react');
// react source code path
const pkgPath = resolvePkgPath(name);
// raect dist path
const pkgDistPath = resolvePkgPath(name, true);

export default [
  {
    // react output config
    input: `${pkgPath}/${module}`,
    output: {
      file: `${pkgDistPath}/index.js`,
      name: 'index.js',
      format: 'umd'
    },
    plugins: [
      ...getBaseRollupPlugins(),
      generagtePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          main: 'index.js'
        })
      })
    ]
  },
  // jsx-runtime out put config
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: [
      // jsx-runtime
      {
        file: `${pkgDistPath}/jsx-runtime.js`,
        name: 'jsx-runtime.js',
        format: 'umd'
      },
      // jsx-dev-runtime
      {
        file: `${pkgDistPath}/jsx-dev-runtime.js`,
        name: 'jsx-dev-runtime.js',
        format: 'umd'
      }
    ],
    plugins: getBaseRollupPlugins()
  }
];

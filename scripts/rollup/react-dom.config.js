import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils';
import generagtePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';

const { name, module, peerDependencies } = getPackageJSON('react-dom');
// react-dom source code path
const pkgPath = resolvePkgPath(name);
// raect-dom dist path
const pkgDistPath = resolvePkgPath(name, true);

export default [
  {
    // react-dom output config
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'ReactDOM',
        format: 'umd'
      },
      {
        // support import reactDOM from 'react-dom/client's
        file: `${pkgDistPath}/client.js`,
        name: 'client',
        format: 'umd'
      }
    ],
    external: [...Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`
        }
      }),
      generagtePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          peerDependencies: {
            react: version
          },
          main: 'index.js'
        })
      })
    ]
  },
  {
    // react-test-utils
    input: `${pkgPath}/test-utils.ts`,
    output: [
      {
        file: `${pkgDistPath}/test-utils.js`,
        name: 'testUtils',
        format: 'umd'
      },
      {
        // support import reactDOM from 'react-dom/client's
        file: `${pkgDistPath}/client.js`,
        name: 'client.js',
        format: 'umd'
      }
    ],
    external: ['react-dom', 'react'],
    plugins: [...getBaseRollupPlugins()]
  }
];

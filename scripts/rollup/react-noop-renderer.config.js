import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils';
import generagtePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';

const { name, module, peerDependencies } = getPackageJSON(
  'react-noop-renderer'
);
// react-noop-renderer source code path
const pkgPath = resolvePkgPath(name);
// raect-dom dist path
const pkgDistPath = resolvePkgPath(name, true);

export default [
  {
    // react-noop-renderer output config
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'ReactNoopRenderer',
        format: 'umd'
      }
    ],
    external: [...Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...getBaseRollupPlugins({
        typescript: {
          exclude: ['./packages/react-dom/**/*'],
          tsconfigOverride: {
            compilerOptions: {
              paths: {
                hostConfig: [`./${name}/src/hostConfig.ts`]
              }
            }
          }
        }
      }),
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
  }
];

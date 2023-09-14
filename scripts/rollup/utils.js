import path from 'path';
import fs from 'fs';

import ts from 'rollup-plugin-typescript2';
import cjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const pkgPath = path.resolve(__dirname, '../../packages');
const distPath = path.resolve(__dirname, '../../dist/node_modules');

/**
 * 函数 `resolvePkgPath` 根据包名称和指示它是否是分发包的标志返回包的路径。
 * @param pkgName - 包或模块的名称。
 * @param isDist - 一个布尔值，指示该包是否是分发包。
 * @returns 指定包的路径。
 */
export function resolvePkgPath(pkgName, isDist) {
  if (isDist) {
    return `${distPath}/${pkgName}`;
  }
  return `${pkgPath}/${pkgName}`;
}

/**
 * 读取并解析给定包名称的 package.json 文件的内容。
 * @param pkgName - `pkgName` 参数是一个字符串，表示您要检索其 `package.json` 文件的包的名称。
 * @returns 从指定包的 package.json 文件中解析的 JSON 对象。
 */
export function getPackageJSON(pkgName) {
  const path = `${resolvePkgPath(pkgName)}/package.json`;
  const str = fs.readFileSync(path, { encoding: 'utf-8' });
  return JSON.parse(str);
}

/**
 * 该函数返回 Rollup 插件数组。
 */
export function getBaseRollupPlugins({
  alias = {
    __DEV__: true,
    preventAssignment: true
  },
  typescript = {}
} = {}) {
  return [replace(alias), cjs(), ts(typescript)];
}

import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const input = 'src/index.ts';

const external = Object.keys(pkg.dependencies || {});

const commonPlugins = [
  nodeResolve(),
  commonjs(),
  json(),
  terser(),
];

const commonOutput = {
  name: 'NitroFetch',
  exports: 'named',
  sourcemap: false,
};

export default [
  // ESM
  {
    input,
    external,
    output: [
      {
        ...commonOutput,
        file: pkg.module,
        format: 'esm',
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        rootDir: 'src',
        exclude: ["**/*.test.ts"],
        sourceMap: false,
      }),
      ...commonPlugins,
    ],
  },
  // CJS
  {
    input,
    external,
    output: [
      {
        ...commonOutput,
        file: pkg.main,
        format: 'cjs',
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        rootDir: 'src',
        exclude: ["**/*.test.ts"],
        sourceMap: false,
      }),
      ...commonPlugins,
    ],
  },
  // UMD
  {
    input,
    external,
    output: [
      {
        ...commonOutput,
        file: pkg.browser,
        format: 'umd',
        name: 'NitroFetch',
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        rootDir: 'src',
        exclude: ["**/*.test.ts"],
        sourceMap: false,
      }),
      ...commonPlugins,
    ],
  },
]; 
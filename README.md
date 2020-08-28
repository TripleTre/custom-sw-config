在使用 `create-react-app` 创建的项目中，已经自带有一个 serviceWorker.js 文件，为项目打包后的资源文件提供了离线缓存，我们只需要开启或关闭这项特性。一般情况下，默认的缓存配置和策略已经够用，但是在我们项目中遇到了如下需求

1. 项目打包后的资源需要做离线缓存
2. 对于某些远程资源(非项目内)也需要能够缓存
3. 及时更新，用户不需要关闭当前 tab 页也能访问到最新版本

下面介绍如果实现这些需求。

### 去除原始配置

`create-react-app` 使用 `WorkboxWebpackPlugin` 插件来实现离线缓存，去到 `{project-root}/config/webpack.config.js` 文件中删除 `WorkboxWebpackPlugin` 相关代码，当前版本下删除的是下面这一段
```
isEnvProduction &&
new WorkboxWebpackPlugin.GenerateSW({
    ...
})
```

然后删除 `{project-root}/src/serviceWorker.js` 并去除 `{project-root}/src/index.js` 中的引用代码。

### 缓存远程资源

要缓存非项目内的远程资源, 我们使用 [Workbox](https://developers.google.com/web/tools/workbox) 库来实现相关功能。

#### 创建 sw.js

在 `{project-root}/src` 目录下新建 sw.js 作为 Service Worker 注册文件，这个文件必须作为一个单独的构建入口，不能和其他项目代码一起打包，所以得修改 `webpack.config.js` 添加多入口。

将原先的 `entry` 配置
```
entry: [
  isEnvDevelopment &&
    require.resolve('react-dev-utils/webpackHotDevClient'),
  paths.appIndexJs,
].filter(Boolean),
```
修改为
```
entry: {
  main: [
    isEnvDevelopment &&
      require.resolve('react-dev-utils/webpackHotDevClient'),
    paths.appIndexJs,
  ].filter(Boolean),
  sw: paths.appSwJs
},
```

`paths.appSwJs` 为 `paths.js` 中新添加的一个路径
```
module.exports = {
  ...
  appSwJs: resolveModule(resolveApp, 'src/sw')
};
```

`filename` 配置修改为

```
filename: chunkData => {
  if (chunkData.chunk.name === "sw") {
    // sw.js 不能带有 hash
    return "sw.js";
  }
  return isEnvProduction
    ? "static/js/[name].[contenthash:8].js"
    : isEnvDevelopment && "[name].bundle.js";
}
```

`runtimeChunk` 修改为

```
runtimeChunk: false
```

如此, 我们就可以在 sw.js 中自由的导入 workbox 库了。

#### 缓存优先

使用 `CacheFirst` 策略缓存远程 mp3/mp4 资源。注意 `CacheableResponsePlugin` 插件的使用，指定只有响应状态码为 0 或者 200 时才缓存资源，否则会把错误的响应也缓存了，并且在之后的请求中一直错误下去。

在我们的项目中，远程资源没有版本号控制，所以使用 `ExpirationPlugin` 来配置缓存何时删除，如果很明确的知道何时该删除远程资源，可以调用 `Workbox` 提供的 api 精确的清除缓存。

```
// sw.js
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

registerRoute(
  ({ url }) => {
    // 筛选出需要缓存的资源
    return /webapp.*saturnv.*\.(?:mp3|mp4)$/.test(url.href);
  },
  new CacheFirst({
    cacheName: 'meida-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true
      })
    ]
  })
)
```

### 项目内资源离线缓存

`create-react-app` 原始配置的离线缓存已经被我们删掉了，因此要自行配置项目内资源的离线缓存。 `Workbox` 提供有 `injectManifest` 函数供我们配置离线缓存，我们需要在 `webpack` 构建后，告知哪些资源做离线缓存。

`injectManifest` 函数的作用就是在 `sw.js` 文件中插入一段代码，指明离线缓存文件列表。因此我们需要先在 `sw.js` 文件中指定插槽。

```
// sw.js
import { precacheAndRoute } from 'workbox-precaching';

// self.__WB_MANIFEST 就是 `Workbox` 指定的插槽,
// 在调用 injectManifest 之后，会被替换成一个数组
// 数组包含有所有需要离线缓存的文件
precacheAndRoute(self.__WB_MANIFEST || [], {
  cleanURLs: false,
});
```

这里没有过多思考，就直接在 `{project-root}/scripts/build.js` 文件中，选择在构建完成之后调用 `injectManifest` 函数，生成离线缓存列表。

```
// {project-root}/scripts/build.js

const { injectManifest } = require('workbox-build');

checkBrowsers(paths.appPath, isInteractive)
  .then(() => { ... })
  .then(previousFileSizes => { ... })
  .then(
    ({ stats, previousFileSizes, warnings }) => {
      // 这里 build 目录已经生成, 可以调用 injectManifest 函数
      injectManifest({
        swSrc: 'build/sw.js',      // 指定要插入缓存的 sw.js 文件
        swDest: 'build/sw.out.js', // 插入缓存后生成的文件路径
        globDirectory: 'build',    // 指定操作的根目录
        globIgnores: [
          'sw.js'                  // 忽略 sw.js 文件自身
        ],
        globPatterns: [
          '**\/*.{js,zip,mp3,png}', // 匹配需要离线缓存的文件, 注意这里没有缓存 html
        ]
      }).then(({count, size}) => {
        console.log(`which will precache ${count} files, totaling ${size} bytes.`);
      });
    })
```

#### 注册 Service Worker

经过以上步骤, build 目录已经生成了 `sw.js` 和 `sw.out.js` 目录。其中 `sw.js` 没有缓存项目内资源, `sw.out.js` 中有项目内资源的缓存列表。

因此，我们可以在开发阶段使用 `sw.js` 注册 `Service Worker`，生产阶段使用 `sw.out.js` 注册 `Service Worker`，这样一来开发阶段也能享受远程资源的缓存，并且本地代码也能够实时更新。

在 `{project-root}/src/index.js` 文件中注册 `Service Worker`

```
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(process.env.NODE_ENV === 'development' ? './sw.js' : './sw.out.js')
    .then(registration => {
      console.log(`Service worker registered with scope: ${registration.scope}`);
    })
}
```

#### 及时更新

按照 `creat-react-app` 的默认配置，`index.html` 也会被离线缓存。在项目发版后，用户第一次访问的任然是缓存的旧版本，并且需要关闭当前 tab 页，再次打开才能访问到新版本。

在我们的配置中，已经去掉 `index.html` 的离线缓存，每次项目发版，用户能够访问到最新的 `index.html`，因此只要让新版的 `Service Worker` 立即生效即可。

在 `sw.js` 中添加以下代码，即可让新版的 `Service Worker` 立即生效，接管缓存。

```
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // clients 是 workbox 创建的全局变量
  event.waitUntil(clients.claim());
});
```

### 参考

* [workbox](https://developers.google.com/web/tools/workbox)
* [Service Worker](https://developers.google.com/web/fundamentals/primers/service-workers?hl=zh-cn)

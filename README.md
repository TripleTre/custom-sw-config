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

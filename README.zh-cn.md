# Solsticio插件框架

受Eclipse Equinox和Trello Power-Ups的启发，**Solsticio插件框架** 可以让第三方通过安全的沙盒向你的应用程序添加额外的功能。
Solsticio的基本想法是，在应用程序中预先定义一组"能力"或"扩展点"，其他人可围绕这些扩展点贡献额外的功能，而无需触及你的代码库
(可能会需要引用一些类型定义文件，仅此而已)。

Solsticio插件框架提供了统一的编程模型，通过2种不同类型的插件，使你的开发团队和第三方都能贡献功能。
这两种插件分别是：*本地插件*和*沙盒插件*。 本地插件与宿主应用一同加载，而沙盒插件被加载在独立的iframe中，只能通过API访问主机应用程序提供的设施。


## 例子

要运行这个例子，在安装了所需的软件包后，分别运行``npm run example-host``和``npm run example-plugins``。 
然后在 http://localhost:3000/buttons.html 的页面上看到来自不同插件的3个按钮。

下面让我们仔细看一下这个例子。

### 扩展点 Extension Point


在上面的例子中，扩展点被定义在```ButtonsExtensionPoints```中。每个扩展点
都应该提供一个扩展声明，其中包括所有需要的数据。 在这个例子中，扩展点是 *@examples/buttons*。

```typescript
export type ButtonsExtension = {
    id: string
    name: string
    extensionPoint: '@examples/buttons'
    text: string
    type: string
    action?: (api: Api) => void
}
```

```Api```是由扩展点提供给其扩展的操作接口，这个例子中实现是一个模态对话框：

```typescript
type Api = {
    show: (title: string, message: string) => void
}
```
为了渲染扩展，需要拿到所有的扩展数据。可使用```useExtensionPoint``` hook:

```typescript
const extensions = useExtensionPoint<ButtonsExtension>(props.runtime, '@examples/buttons')
```

而真正的渲染则是非常直接的，可以将扩展数据当作react组件的数据即可：

```typescript jsx
return (
        <>
            {extensions.map(e => <Button key={e.id} variant={e.type} onClick={handle(e)}>{e.text}</Button>)}

            <Modal show={show}>
                <Modal.Header closeButton>
                    <Modal.Title>{title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>{body}</Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={handleClose}>
                        Save Changes
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    )
```

### 扩展 Extensions

本地插件仅仅是另一种为react组件提供数据的方法：

```typescript
const runtime = Solsticio.runtime({}, console.log)

runtime.define({
    id: '@examples',
    extensionPoints: [{name: 'buttons'}]
})

runtime.install({
    id: '@plugin', extensions: [
        {
            name: 'red',
            extensionPoint: '@examples/buttons',
            text: 'Primary',
            type: 'primary'
        } as ButtonsExtension,
        {
            name: 'warning',
            extensionPoint: '@examples/buttons',
            text: 'Warning',
            type: 'warning'
        } as ButtonsExtension]
})
```

沙盒插件需要指明从何处读取插件：

```typescript
let sandboxPlugins = [
    {
        id: '@sandbox-buttons-extension',
        src: 'http://localhost:3001/buttons.html'
    }
]
```

然后将他们放入插件注册器：

```typescript jsx
<SandboxPluginRegistry runtime={runtime} plugins={sandboxPlugins}></SandboxPluginRegistry>
```

而真正的插件则在 http://localhost:3001/buttons.html ：

```typescript 
import Solsticio from '@solsticio/runtime'

type Api = {
    show: (title: string, message: string) => void
}

let host = Solsticio.plugin({
    id: '@sandbox-buttons-extension',
    extensions: [{
        name: 'button',
        extensionPoint: '@examples/buttons',
        text: 'Button from Sandbox',
        type: 'danger',
        action: (api: Api) => api.show('A message from sea', 'Say hi from sandbox')
    } as any]
}, 'http://localhost:3000')
```

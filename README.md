[中文版](README.zh-cn.md)

# Solsticio Plugin Framework

Inspired by Eclipse Equinox and Trello Power-Ups, **Solsticio** is a plugin framework to enable 3rd parties 
adding extra functionalities to your application via safe sandboxes.  The whole idea is that you have a 
set of pre-defined "capabilities" or "extension points", to which others can contribute additional functionalities 
without touching your codebase (importing type definition files may be required).

Solsticio plugin framework provides a unified programming model to contribute features both from your development team
and 3rd parties via 2 different types of plugin: *local plugin* and *sandbox plugin*. Local plugins are loaded 
in the same window of the host application, they share all the resources of the host. On the contrary,
sandbox plugins are loaded in separated iframes and can only access the facilities provided by host application via APIs. 

## Example

To run the example, you have to run ```npm run example-host``` and ```npm run example-plugins``` separately after
install the required packages, and you should see 3 buttons from different plugins on http://localhost:3000/buttons.html.

Let's take a closer look at this example.

### Extension Point

In the above example, extension pont is defined in ```ButtonsExtensionPoints```. Every extension point 
should provide an extension declaration which the all data required if plugin would like to contribute to
this extension point. In this example, the extension point is *@examples/buttons*

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

And the ```Api``` is provided by extension point to its extensions, in this simple example, it is function to open
a modal window on the host: 

```typescript
type Api = {
    show: (title: string, message: string) => void
}
```

And for render the extensions, first we need to get all the extensions provided by other plugins. It uses the ```useExtensionPoint``` hook:

```typescript
const extensions = useExtensionPoint<ButtonsExtension>(props.runtime, '@examples/buttons')
```

The actual rendering of the extension point is really straightforward. Just treated all extensions as 
data for the react component: 

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

### Extensions

Local plugins are just a different way to provide data to react component: 

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

And for the remote one, we have to specify where the plugin stays: 

```typescript
let sandboxPlugins = [
    {
        id: '@sandbox-buttons-extension',
        src: 'http://localhost:3001/buttons.html'
    }
]
```

and load them to a plugin registry, which will generate all the iframes needed:

```typescript jsx
<SandboxPluginRegistry runtime={runtime} plugins={sandboxPlugins}></SandboxPluginRegistry>
```

And the actual plugin located at *http://localhost:3001/buttons.html* are: 

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
 

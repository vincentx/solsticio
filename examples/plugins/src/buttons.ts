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
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {fireEvent, render} from '@testing-library/react'
import SandboxPluginRegistry, {SandboxPlugin} from '../../src/components/sandbox-plugin-registry'

// @vitest-environment jsdom
describe('useExtensionPoint hook', () => {
    let _runtime

    beforeEach(() => {
        _runtime = {
            sandbox: vi.fn()
        }
    })

    it('should generate iframe for sandbox plugin', async () => {
        let plugins = [{id: '@plugin', src: 'https://plugin.com/'}]

        let {container} = render(<SandboxPluginRegistry runtime={_runtime} plugins={plugins}/>)

        let sandboxes: NodeListOf<HTMLIFrameElement> = container.querySelectorAll('.solsticio-sandbox');

        expect(sandboxes.length).toEqual(1)

        assertRendered(plugins[0], sandboxes[0])
    })

    it('should generate iframes for sandbox plugins', async () => {
        let plugins = [{id: '@plugin-a', src: 'https://plugin-a.com/'}, {id: '@plugin-b', src: 'https://plugin-b.com/'}]

        let {container} = render(<SandboxPluginRegistry runtime={_runtime} plugins={plugins}/>)

        let sandboxes: NodeListOf<HTMLIFrameElement> = container.querySelectorAll('.solsticio-sandbox');

        expect(sandboxes.length).toEqual(plugins.length)

        for (let i = 0; i < plugins.length; i++)
            assertRendered(plugins[i], sandboxes[i])
    })

    it('should call runtime to install plugin after iframe loaded', () => {
        let plugins = [{id: '@plugin', src: 'https://plugin.com/'}]

        let {container} = render(<SandboxPluginRegistry runtime={_runtime} plugins={plugins}/>)

        let sandboxes: NodeListOf<HTMLIFrameElement> = container.querySelectorAll('.solsticio-sandbox');

        fireEvent(sandboxes[0], new Event('load'))

        expect(_runtime.sandbox).toHaveBeenCalledWith('@plugin', 'https://plugin.com/', sandboxes[0].contentWindow!)
    })

    function assertRendered(plugin: SandboxPlugin, sandbox: HTMLIFrameElement) {
        expect(sandbox.dataset['pluginId']).toEqual(plugin.id)
        expect(sandbox.src).toEqual(plugin.src)
        expect(sandbox.height).toEqual('0')
        expect(sandbox.width).toEqual('0')
        expect(sandbox.style.display).toEqual('none')

    }
})

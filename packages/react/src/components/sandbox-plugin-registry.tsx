import {SandboxRuntime} from '@solsticio/runtime'
import {useRef} from 'react'

export type SandboxPlugin = {
    id: string
    src: string
}

type RegistryProps = {
    runtime: SandboxRuntime
    plugins: SandboxPlugin[]
}

export default function SandboxPluginRegistry(props: RegistryProps) {
    const elements = useRef<Map<string, HTMLIFrameElement>>(new Map())

    function renderSandbox(plugin: SandboxPlugin) {
        function onLoad() {
            props.runtime.sandbox(plugin.id, plugin.src, elements.current!.get(plugin.id)!.contentWindow!)
        }

        return <iframe width="0" height="0" className="solsticio-sandbox" style={{display: "none"}}
                       key={plugin.id} data-plugin-id={plugin.id} src={plugin.src}
                       ref={(ref) => elements.current.set(plugin.id, ref!)}
                       onLoad={onLoad}></iframe>
    }

    return (<>
            {props.plugins.map(renderSandbox)}
        </>
    )
}
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
    function renderSandbox(plugin: SandboxPlugin) {
        return <IframeSandbox plugin={plugin} runtime={props.runtime}/>
    }

    return (<>{props.plugins.map(renderSandbox)}</>)
}

function IframeSandbox(props: { plugin: SandboxPlugin, runtime: SandboxRuntime }) {
    const element = useRef<HTMLIFrameElement | null>(null)

    function onLoad() {
        props.runtime.sandbox(props.plugin.id, props.plugin.src, element.current!.contentWindow!)
    }

    return <iframe width="0" height="0" className="solsticio-sandbox" style={{display: "none"}}
                   key={props.plugin.id} data-plugin-id={props.plugin.id} src={props.plugin.src}
                   ref={element}
                   onLoad={onLoad}></iframe>
}
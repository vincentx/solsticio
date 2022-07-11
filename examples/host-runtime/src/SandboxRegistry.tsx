import {SandboxRuntime} from '@solsticio/runtime'
import {useRef} from "react";

type Plugin = {
    id: string
    src: string
}

export default function SandboxRegistry(props: { runtime: SandboxRuntime, plugins: Plugin[] }) {
    const iframe = useRef<null | HTMLIFrameElement>(null)

    function load(plugin: Plugin) {
        return function () {
            return props.runtime.sandbox(plugin.id, plugin.src, iframe.current!.contentWindow!)
        }
    }

    return (<>
        {props.plugins.map(plugin => <iframe width="1" height="1" key={plugin.id} src={plugin.src} ref={iframe}
                                             onLoad={load(plugin)}></iframe>)}
    </>)
}
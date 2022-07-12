import Solsticio from '@solsticio/runtime'
import ButtonsExtensionPoints, {ButtonsExtension} from "./ButtonsExtensionPoints";
import {SandboxPluginRegistry, useExtensionPoint} from "@solsticio/react";


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

let sandboxPlugins = [
    {
        id: '@sandbox-buttons-extension',
        src: 'http://localhost:3001/buttons.html'
    }
]

export default function ButtonHost() {
    return (<main>
            <h1 className="visually-hidden">Solsticio examples</h1>

            <div className="px-4 py-5 my-5 text-center">
                <h1 className="display-5 fw-bold">Solsticio Example</h1>
                <div className="col-lg-8 mx-auto">
                    <p className="lead mb-4">
                        A simple example of Solsticio plugin framework. The below area is an <b>extension
                        point</b> named
                        <b>@examples/buttons</b>. As the name suggests, it will render buttons based on different
                        extensions. The host will provide an api to show a modal window. Extensions can ask the host
                        to display a modal for them. For now, there are two plugins: a local one contributes the first
                        two buttons, and a sandbox loaded from http://localhost:3001/buttons.html. You can find its code
                        below the extension points.
                    </p>

                    <div className="d-grid gap-2 d-sm-flex justify-content-sm-center">
                        <ButtonsExtensionPoints runtime={runtime}></ButtonsExtensionPoints>
                    </div>
                </div>
            </div>
            <div className="px-4 py-5 my-5 text-center">
                <h5 className="display-10 fw-bold">The sandbox plugin load from http://localhost:3001/buttons.html</h5>
                <div className="col-lg-8 mx-auto">
                    <p className="lead mb-4">
                        <iframe src="http://localhost:3001/buttons.html" height="350" className="col-lg-12 mx-auto"/>
                    </p>
                </div>
            </div>


            <SandboxPluginRegistry runtime={runtime} plugins={sandboxPlugins}></SandboxPluginRegistry>
        </main>
    )
}
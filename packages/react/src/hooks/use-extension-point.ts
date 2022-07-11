import {Extension, Runtime} from '@solsticio/runtime'
import {useEffect, useState} from 'react'

export default function useExtensionPoint<E extends Extension>(runtime: Runtime, id: string): E[] {
    const [extensions, setExtensions] = useState(runtime.extensions(id))

    useEffect(() => {
        runtime.watch('@core/buttons', setExtensions)
        return () => runtime.unwatch('@core/buttons', setExtensions)
    })

    return extensions as E[]
}
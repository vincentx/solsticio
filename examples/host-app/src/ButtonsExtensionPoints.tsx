import {useExtensionPoint} from '@solsticio/react'
import {Runtime} from '@solsticio/runtime'
import React from 'react'
import {Button, Modal} from 'react-bootstrap'

type Api = {
    show: (title: string, message: string) => void
}

export type ButtonsExtension = {
    id: string
    name: string
    extensionPoint: '@examples/buttons'
    text: string
    type: string
    action?: (api: Api) => void
}

export default function ButtonsExtensionPoints(props: { runtime: Runtime }) {
    const extensions = useExtensionPoint<ButtonsExtension>(props.runtime, '@examples/buttons')

    const [show, setShow] = React.useState(false)
    const [title, setTitle] = React.useState('Whoop!')
    const [body, setBody] = React.useState('the extension not provide an action')

    const handleClose = () => setShow(false)

    let api = {
        show(title: string, message: string) {
            setTitle(title)
            setBody(message)
            setShow(true)
        }
    }

    function handle(e: ButtonsExtension) {
        return function () {
            if (e.action) e.action(api)
            else {
                setBody(`${e.id} does not provide an action`)
                setShow(true)
            }
        }
    }

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
}
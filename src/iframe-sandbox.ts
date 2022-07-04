import {v4 as uuid} from "uuid";

export class Proxy<Context> {
    private _receiver: Window;
    private _target: Window;
    private readonly _queue: Map<string, (value: any) => void>

    constructor(receiver: Window, target: Window) {
        this._receiver = receiver;
        this._target = target;
        this._queue = new Map()

        this._receiver.addEventListener('message', (e) => {
            let message = e.data as { id: string, response: any }
            if (this._queue.has(message.id)) {
                let resolve = this._queue.get(message.id)!
                this._queue.delete(message.id)
                resolve(message.response)
            }
        })
    }

    fetch(): Promise<Context> {
        return new Promise<Context>((resolve) => {
            let id = uuid()
            this._queue.set(id, resolve)

            this._target.postMessage({
                id: id,
                request: 'context'
            }, "*")
        })
    }
}

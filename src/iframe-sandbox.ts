import {v4 as uuid} from "uuid";

export class Proxy<Context> {
    private _target: Window;
    private readonly _context: Context;
    private readonly _queue: Map<string, (value: any) => void> = new Map()

    constructor(receiver: Window, target: Window, context: Context) {
        this._target = target;
        this._context = context;

        receiver.addEventListener('message', (e) => {
            let message = e.data as { id: string, response: any }
            if (this._queue.has(message.id)) {
                let resolve = this._queue.get(message.id)!
                this._queue.delete(message.id)
                resolve(message.response)
            }
        })
    }

    fetch(time: number): Promise<Context> {
        return this.timeout(new Promise<Context>((resolve) => {
            let id = uuid()
            this._queue.set(id, resolve)
            this._target.postMessage({
                id: id,
                request: 'context'
            }, "*")
        }), time)
    }

    private timeout<Context>(promise: Promise<Context>, time: number) {
        return Promise.race([promise, new Promise<Context>((resolve) => setTimeout(resolve, time, this._context))])
    }

}

export class Proxy<Context> {
    private _receiver: Window;
    private _target: Window;

    constructor(receiver: Window, target: Window) {
        this._receiver = receiver;
        this._target = target;
    }

    fetch(): Promise<Context> {
        return new Promise<Context>((resolve) => {
            this._receiver.addEventListener('message', (e) => {
                return resolve(e.data as Context)
            })

            this._target.postMessage('fetch', "*")
        })
    }
}

export class Client {
    private _window: Window;
    private readonly _context: any;
    private readonly _source: (e: MessageEvent) => Window;

    constructor(window: Window, context: any, source: (e: MessageEvent) => Window = e => e.source as Window) {
        this._window = window;
        this._context = context;
        this._source = source;

        this._window.addEventListener('message', (e) => {
            let from = this._source(e);
            from.postMessage(this._context, "*")
        })
    }
}
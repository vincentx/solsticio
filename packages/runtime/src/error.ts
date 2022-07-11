export default class Collector {
    private readonly _collector: (message: string) => void

    constructor(collector: (message: string) => void) {
        this._collector = collector;
    }

    collect(...messages: string[]) {
        this._collector(messages.join(' '))
    }

    error(...messages: string[]) {
        let message = messages.join(' ');
        this._collector(message)
        throw message
    }
}
export class ErrorCollector {
    private readonly _collector: (message: string) => void

    constructor(collector: (message: string) => void) {
        this._collector = collector;
    }

    error(...messages: string[]) {
        this._collector(messages.join(' '))
    }
}
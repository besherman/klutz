import {Injectable} from "angular2/core";
import {Move} from "./move";


interface Command {
    message: string;

    /** returns true if it wants more input */
    consume(line: string): boolean;
}

class InitCommand implements Command {
    public message: string = null;
    public consume(line: string): boolean {
        console.log("engine init: " + line);
        return false;
    }
}

class UCICommand implements Command {
    public message: string = "uci";

    public consume(line: string): boolean {
        // TODO: parse options
        return line.indexOf("uciok") == -1;
    }
}

class ReadyCommand implements Command {
    public message: string = "isready";

    public consume(line: string): boolean {
        console.log("ready: " + line);
        return line.indexOf("readyok") == -1;
    }
}


class DescribeCommand implements Command {
    public message: string = "d";
    public promise: Promise<DescribeResult>;
    private _resolve: (arg: DescribeResult) => void;
    private _legalSAN: Array<string>;
    private _legalLAN: Array<string>;
    private _fen: string;

    public constructor() {
        this.promise = new Promise<DescribeResult>(((resolve: (arg: DescribeResult) => void, reject: (arg: any) => void) => {
            this._resolve = resolve;
        }).bind(this));
    }

    public consume(line: string): boolean {
        console.log(line);

        if(line.indexOf("Legal moves:") != -1) {
            this._legalSAN = line.substring(13).trim().split(" ");
        }

        if(line.indexOf("Legal uci moves:") != -1) {
            this._legalLAN = line.substring(17).trim().split(" ");
        }

        if(line.indexOf("Fen:") != -1) {
            this._fen = line.substring(5).trim();
        }


        if(line.indexOf("Legal uci moves") == -1) {
            return true;
        } else {
            this._resolve(this._buildResult());
            return false;
        }
    }

    private _buildResult(): DescribeResult {
        let moves: Array<Move> = [];
        for(let i = 0; i < this._legalSAN.length; i++) {
            moves.push({ lan: this._legalLAN[i], san: this._legalSAN[i] });
        }
        return {
            "moves": moves,
            "fen": this._fen
        };
    }
}

export interface DescribeResult {
    moves: Array<Move>;
    fen: string;
}

class EvalCommand implements Command {
    public message: string = "eval";

    public consume(line: string): boolean {
        console.log("eval: " + line);
        //return line.indexOf("readyok") == -1;
        return true;
    }
}

class PositionCommand implements Command {
    public message: string;

    public constructor(fen: string, move: string) {
        this.message = `position fen ${fen} moves ${move}`
    }

    public consume(line: string): boolean {
        console.log("eval: " + line);
        //return line.indexOf("readyok") == -1;
        return true;
    }
}

@Injectable()
export class Engine {
    private _worker: Worker;
    private _cmdQueue: Array<Command> = [];

    constructor() {
        console.log("creating instance of engine");
        this._cmdQueue.push(new InitCommand());
        this._cmdQueue.push(new UCICommand());
        this._cmdQueue.push(new ReadyCommand());
        this._worker = new Worker("/resources/stockfish.js");
        this._worker.onmessage = this._onMessage.bind(this);
    }

    public describe(): void {
        let cmd = new DescribeCommand();
        cmd.promise.then(arg => console.log(arg));
        this._exec(cmd);
    }

    public eval(): void {
        let cmd = new EvalCommand();
        this._exec(cmd);
    }

    public position(fen: string, move: string): void {
        let cmd = new PositionCommand(fen, move);
        this._exec(cmd);
    }

    _exec(cmd: Command) {
        this._cmdQueue.push(cmd);
        if(this._cmdQueue.length == 1) {
            console.log("sending to engine: " + cmd.message);
            this._worker.postMessage(cmd.message);
        }
    }

    _onMessage(evt: MessageEvent) {
        if(this._cmdQueue.length === 0) {
            console.log("engine: no command on stack");
            console.log(evt.data);
            return;
        }

        let cmd = this._cmdQueue[0];
        let keep = cmd.consume(evt.data);

        console.log(`command ${cmd.message} received data ${evt.data}`);
        if(keep === false) {
            console.log(`command ${cmd.message} is finished`);
            this._cmdQueue.shift();

            if(!this._empty()) {
                console.log("there are more commands on the queue");
                console.log("sending to engine: " + this._cmdQueue[0].message);
                this._worker.postMessage(this._cmdQueue[0].message);
            } else {
                console.log("no more command on the queue");
            }
        }
    }

    private _empty(): boolean {
        return this._cmdQueue.length == 0;
    }
}

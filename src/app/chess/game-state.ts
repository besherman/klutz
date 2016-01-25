import {Move} from "./move";

export interface GameState {
    get board: string;
    get allowedMoves: Array<Move>;
    get sideToMove: string,
    get message: string;
}

export class DefaultGameState implements GameState {
    public constructor(fen: string, Array<Move> allowedMoves) {

    }
}
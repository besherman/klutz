/**
 * Created by Richard on 2016-01-18.
 */

import {Move} from "./move";

export interface Context {
    board: string;
    allowedMoves: Array<Move>;
    sideToMove: string,
    message: string;
}


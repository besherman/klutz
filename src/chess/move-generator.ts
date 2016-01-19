/**
 * Created by Richard on 2016-01-18.
 */

import {Context} from "./context";

export interface MoveGenerator {
    first(initialBoard: string): void;
    move(state: any, move: any): void;
}

import {MoveGenerator} from "./move-generator";
import {Move} from "./move";
import {Context} from "./context";


// TODO: use https://github.com/nmrugg/stockfish.js

interface Board {
    pieceColor: Array<number>;
    pieceType: Array<number>;
    side: number;
    xside: number;
    castle: number;
    ep: number;
    fifty: number;
    fullmove: number;
    check: boolean;
}

interface PotentialMove {
    from: number;
    to: number;
    bits: number;
    promote: number;
}

interface ParsedSAN {
    piece?: string;
    fromFile?: string;
    fromRank?: string;
    capture?: boolean;
    toFile?: string;
    toRank?: string;
    promPiece?: string;
    castle?: string;
}


const WHITE = 0;
const BLACK = 1;
const PAWN = 0;
const KNIGHT = 1;
const BISHOP = 2;
const ROOK = 3;
const QUEEN = 4;
const KING = 5;
const EMPTY = 6;

/* useful squares */
const A1 = 56;
const B1 = 57;
const C1 = 58;
const D1 = 59;
const E1 = 60;
const F1 = 61;
const G1 = 62;
const H1 = 63;
const A8 = 0;
const B8 = 1;
const C8 = 2;
const D8 = 3;
const E8 = 4;
const F8 = 5;
const G8 = 6;
const H8 = 7;

/**
 * Now we have the MAILBOX array, so called because it looks like a MAILBOX,
 * at least according to Bob Hyatt. This is useful when we need to figure
 * out what pieces can go where. Let's say we have a rook on square a4 (32)
 * and we want to know if it can move one square to the left. We subtract 1,
 * and we get 31 (h5). The rook obviously can't move to h5, but we don't
 * know that without doing a lot of annoying work. Sooooo, what we do is
 * figure out a4's MAILBOX number, which is 61. Then we subtract 1 from 61
 * (60) and see what MAILBOX[60] is. In this case, it's -1, so it's out of
 * bounds and we can forget it. You can see how MAILBOX[] is used in
 * attack() in board.c.
 */
const MAILBOX = [
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, 0, 1, 2, 3, 4, 5, 6, 7, -1,
    -1, 8, 9, 10, 11, 12, 13, 14, 15, -1,
    -1, 16, 17, 18, 19, 20, 21, 22, 23, -1,
    -1, 24, 25, 26, 27, 28, 29, 30, 31, -1,
    -1, 32, 33, 34, 35, 36, 37, 38, 39, -1,
    -1, 40, 41, 42, 43, 44, 45, 46, 47, -1,
    -1, 48, 49, 50, 51, 52, 53, 54, 55, -1,
    -1, 56, 57, 58, 59, 60, 61, 62, 63, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1
];

const MAILBOX64 = [
    21, 22, 23, 24, 25, 26, 27, 28,
    31, 32, 33, 34, 35, 36, 37, 38,
    41, 42, 43, 44, 45, 46, 47, 48,
    51, 52, 53, 54, 55, 56, 57, 58,
    61, 62, 63, 64, 65, 66, 67, 68,
    71, 72, 73, 74, 75, 76, 77, 78,
    81, 82, 83, 84, 85, 86, 87, 88,
    91, 92, 93, 94, 95, 96, 97, 98
];

/* slide, offsets, and offset are basically the vectors that
 pieces can move in. If slide for the piece is FALSE, it can
 only move one square in any one direction. offsets is the
 number of directions it can move in, and offset is an array
 of the actual directions. */
const SLIDE = [false, false, true, true, true, false];

const OFFSETS = [0, 8, 4, 4, 8, 8];

const OFFSET = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [-21, -19, -12, -8, 8, 12, 19, 21],
    [-11, -9, 9, 11, 0, 0, 0, 0],
    [-10, -1, 1, 10, 0, 0, 0, 0],
    [-11, -10, -9, -1, 1, 9, 10, 11],
    [-11, -10, -9, -1, 1, 9, 10, 11]
];

/* the initial board state */
const INIT_COLOR = [
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0
];
const INIT_PIECE = [
    3, 1, 2, 4, 5, 2, 1, 3,
    0, 0, 0, 0, 0, 0, 0, 0,
    6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6,
    0, 0, 0, 0, 0, 0, 0, 0,
    3, 1, 2, 4, 5, 2, 1, 3
];

/* This is the CASTLE_MASK array. We can use it to determine
 the castling permissions after a move. What we do is
 logical-AND the castle bits with the CASTLE_MASK bits for
 both of the move's squares. Let's say castle is 1, meaning
 that white can still castle kingside. Now we play a move
 where the rook on h1 gets captured. We AND castle with
 CASTLE_MASK[63], so we have 1&14, and castle becomes 0 and
 white can't castle kingside anymore. */
const CASTLE_MASK = [
    7, 15, 15, 15, 3, 15, 15, 11,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    13, 15, 15, 15, 12, 15, 15, 14
];

/**
 * The ascii value of the character points to a bit field.
 * Bits 1-3 is color
 * Bits 4-6 is piece type
 * Bits 7-10 is how much to move forward
 */
const FEN_DATA = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 0, 182,
    310, 438, 566, 694, 822, 950, 1078, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 144, 0, 0, 0, 0, 0, 0, 0, 0, 168, 0, 0,
    136, 0, 128, 160, 152, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 145, 0, 0, 0, 0, 0, 0, 0, 0, 169, 0,
    0, 137, 0, 129, 161, 153];


const RANK_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8"];
const FILE_NAMES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PIECE_NAMES = ["P", "N", "B", "R", "Q", "K"];

/** The bit that signifies capture in move.bits. */
const CAPTURE_FLAG = 1;

/** The bit that signifies castle in move.bits. */
const CASTLE_FLAG = 2;

/** The bit that signifies en passant capture in move.bits. */
const EN_PASSANT_FLAG = 4;

/** The bit that signifies a pawn moving two ranks in move.bits. */
const DOUBLE_PAWN_FLAG = 8;

/** The bit that signifies a pawn move in move.bits. */
const PAWN_MOVE_FLAG = 16;

/** The bit that signifies promotion in move.bits. */
const PROMOTE_FLAG = 32;

const CASTLE_WHITE_KING_FLAG = 1;
const CASTLE_WHITE_QUEEN_FLAG = 2;
const CASTLE_BLACK_KING_FLAG = 4;
const CASTLE_BLACK_QUEEN_FLAG = 8;


/**
 * Cut and paste from an old project.
 * TODO: well... fix it...
 */
class ChessEngine {
    /**
     * Returns the rank (or row) as an integer between 0 and 7
     * @param {type} sq the square we are interested in
     * @returns {Number} an integer between 0 and 7
     */
    static getRank(sq:number):number {
        return (sq >> 3) ^ 7;
    }

    /**
     * Returns the file (or column) as an integer between 0 and 7
     * @param {type} sq the square we are interested in
     * @returns {Number} an integer between 0 and 7
     */
    static getFile(sq:number):number {
        return (sq & 7);
    }

    static getSquare(file:number, rank:number):number {
        return file | ((rank ^ 7) << 3);
    }

    /**
     * Returns the name of the given square.
     * @param {type} sq the square we are interested in.
     * @returns {String} e4 or similar
     */
    static toNotation(sq:number):string {
        var rank = ChessEngine.getRank(sq),
            file = ChessEngine.getFile(sq);
        return FILE_NAMES[file] + RANK_NAMES[rank];
    };

    /**
     * Creates a new potential move.
     * TODO: create a class
     */
    static createMove(from: number, to: number, bits: number, promote: number): PotentialMove {
        // This is a bit of ugly hack, should not be done here (?)
        if (promote !== EMPTY) {
            bits = bits | PROMOTE_FLAG;
        }

        return {
            from: from,
            to: to,
            bits: bits,
            promote: promote
        };
    }

    // TODO: rename
    static copyBoardUnfrozen(original: Board) {
        const newBoard: Board = {
            pieceColor: [],
            pieceType: [],
            side: original.side,
            xside: original.xside,
            castle: original.castle,
            ep: original.ep,
            fifty: original.fifty,
            fullmove: original.fullmove,
            check: false
        };
        for (let i = 0; i < 64; i++) {
            newBoard.pieceColor[i] = original.pieceColor[i];
            newBoard.pieceType[i] = original.pieceType[i];
        }
        return newBoard;
    }

    /**
     * Creates a new chunk of data that contains the board information.
     */
    static createBoard(): Board {
        const newBoard: Board = {
            /* the board representation */
            pieceColor: [], /* LIGHT, DARK, or EMPTY */

            pieceType: [], /* PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, or EMPTY */

            /* the side to move */
            side: WHITE,

            /* the side not to move */
            xside: BLACK,

            /**
             * a bitfield with the castle permissions. if 1 is set,
             * white can still castle kingside. 2 is white queenside.
             * 4 is black kingside. 8 is black queenside.
             **/
            castle: 15,

            /**
             * the en passant square. if white moves e2e4, the en passant
             * square is set to e3, because that's where a pawn would move
             * in an en passant capture
             **/
            ep: -1,

            /**
             * the number of moves since a capture or pawn move, used
             * to handle the fifty-move-draw rule
             **/
            fifty: 0,

            /**
             * This will have the value "1" for the first move of a game for both White
             * and Black.  It is incremented by one immediately after each move by Black.
             */
            fullmove: 1,

            /**
             * true if the current player is in check
             */
            check: false
        };
        for (let i = 0; i < 64; i++) {
            newBoard.pieceColor[i] = INIT_COLOR[i];
            newBoard.pieceType[i] = INIT_PIECE[i];
        }

        return newBoard;
    }

    /**
     * Creates a FEN representation of the board.
     */
    static toFEN(board: Board):string {
        let result = "";
        let emptyBefore = 0;

        for (let i = 0; i < 64; i++) {
            let color = board.pieceColor[i];
            let type = board.pieceType[i];

            if (type === EMPTY) {
                emptyBefore++;
            } else {
                if (emptyBefore > 0) {
                    result += emptyBefore;
                    emptyBefore = 0;
                }
                result += (color === WHITE) ? PIECE_NAMES[type] : PIECE_NAMES[type].toLowerCase();
            }
            if (ChessEngine.getFile(i) === 7) {
                if (emptyBefore > 0) {
                    result += emptyBefore;
                    emptyBefore = 0;
                }
                if (i < 63) {
                    result += "/";
                }
            }
        }
        result += " ";
        result += board.side === WHITE ? "w" : "b";
        result += " ";

        if (board.castle === 0) {
            result += "-";
        } else {
            if ((board.castle & CASTLE_WHITE_KING_FLAG) > 0) {
                result += "K";
            }
            if ((board.castle & CASTLE_WHITE_QUEEN_FLAG) > 0) {
                result += "Q";
            }
            if ((board.castle & CASTLE_BLACK_KING_FLAG) > 0) {
                result += "k";
            }
            if ((board.castle & CASTLE_BLACK_QUEEN_FLAG) > 0) {
                result += "q";
            }
        }
        result += " ";

        // en passant
        if (board.ep === -1) {
            result += "-";
        } else {
            result += ChessEngine.toNotation(board.ep);
        }
        result += " ";

        //
        // This number is the count of halfmoves (or ply) since the last pawn
        // advance or capturing move.  This value is used for the fifty move
        // draw rule.
        result += board.fifty;
        result += " ";


        // fullmove number
        // This will have the value "1" for the first move of a game for both White
        // and Black.  It is incremented by one immediately after each move by Black.
        result += board.fullmove;

        return result;
    }

    /**
     * Returns the difference between the character codes of the first character in str1 and str2.
     */
    static cdiff(str1:string, str2:string): number {
        return str1.charCodeAt(0) - str2.charCodeAt(0);
    };

    static toLAN(board: Board, from: number, to: number, promote: number): string {
        return ChessEngine.toNotation(from) + ChessEngine.toNotation(to) + (promote ? "=" + PIECE_NAMES[promote] : "");
    }

    static toSAN(board: Board, from: number, to: number, promote: number): string {
        return "?";
    }

    static getPossibleMoves(board: Board): Array<Move> {
        const result: Array<Move> = [];
        const psuedo = ChessEngine.getAllPossiblePsuedoMoves(board);

        for (let i = 0; i < psuedo.length; i++) {
            let move = psuedo[i];
            if (ChessEngine.makeMove(board, move)) {
                result.push({
                    lan: ChessEngine.toLAN(board, move.from, move.to, move.promote),
                    san: ChessEngine.toSAN(board, move.from, move.to, move.promote)
                });
            }
        }

        return result;
    }

    static getPieces(board: Board): Array<string> {
        const result: Array<string> = [];
        for (let i = 0; i < 64; i++) {
            if (board.pieceType[i] === EMPTY) {
                result.push(null);
            } else {
                var piece = PIECE_NAMES[board.pieceType[i]].toLowerCase();
                result.push((board.pieceColor[i] === WHITE ? "w" : "b") + piece);
            }
        }
        return result;
    }

    static getNextPlayer(board: Board): string {
        return board.side === WHITE ? "white" : "black";
    }

    /**
     * Move in long algebraic notation
     */
    static move(board: Board, move: Move): Board {
        var fromSq = ChessEngine.getSquare(move.lan.charCodeAt(0) - 97, move.lan.charCodeAt(1) - 49),
            toSq = ChessEngine.getSquare(move.lan.charCodeAt(2) - 97, move.lan.charCodeAt(3) - 49);
        var promote = move.lan.length === 6 ? PIECE_NAMES.indexOf(move.lan.charAt(5)) : EMPTY;
        var pm = ChessEngine.getPsuedoMoveForPiece(board, fromSq, toSq, promote);
        return pm ? ChessEngine.makeMove(board, pm) : null;
    }


    /**
     * Returns a new board where the given board has been advanced with the
     * given move, or null if the move was not allowed.
     */
    static moveSAN(board: Board, san: string): Board {
        const buffer = ChessEngine.parseSAN(san);
        if (!buffer) {
            return null;
        }

        let move: PotentialMove = null;
        let fromSq: number = null;
        let newBoard: Board = null;

        let piece = PAWN;
        if (typeof buffer.castle !== "undefined") {
            if (buffer.castle === "K") {
                if (board.side === WHITE) {
                    move = ChessEngine.getPsuedoMoveForPiece(board, E1, G1, EMPTY);
                } else {
                    move = ChessEngine.getPsuedoMoveForPiece(board, E8, G8, EMPTY);
                }
            } else {
                if (board.side === WHITE) {
                    move = ChessEngine.getPsuedoMoveForPiece(board, E1, C1, EMPTY);
                } else {
                    move = ChessEngine.getPsuedoMoveForPiece(board, E8, C8, EMPTY);
                }
            }
            return move ? ChessEngine.makeMove(board, move) : null;
        }

        let toSq = (ChessEngine.cdiff(buffer.toFile, "a")) | (((ChessEngine.cdiff(buffer.toRank, "1")) ^ 7) << 3);

        switch (buffer.piece) {
            case "K":
                piece = KING;
                break;
            case "Q":
                piece = QUEEN;
                break;
            case "R":
                piece = ROOK;
                break;
            case "N":
                piece = KNIGHT;
                break;
            case "B":
                piece = BISHOP;
                break;
        }

        var promote = EMPTY;
        switch (buffer.promPiece) {
            case "K":
                promote = KING;
                break;
            case "Q":
                promote = QUEEN;
                break;
            case "R":
                promote = ROOK;
                break;
            case "N":
                promote = KNIGHT;
                break;
            case "B":
                promote = BISHOP;
                break;
        }

        let fromRank = typeof(buffer.fromRank) === "undefined" ? -1 : ChessEngine.cdiff(buffer.fromRank, "0");
        let fromFile = typeof(buffer.fromFile) === "undefined" ? -1 : ChessEngine.cdiff(buffer.fromFile, "a");



        // we have both rank and file
        if (fromRank !== -1 && fromFile !== -1) {
            fromSq = fromFile | ((fromRank ^ 7) << 3);
            move = ChessEngine.getPsuedoMoveForPiece(board, fromSq, toSq, promote);
            return move ? ChessEngine.makeMove(board, move) : null;
        }

        // we have only file
        if (fromFile !== -1) {
            for (let i = fromFile; i < 64; i += 8) {
                move = ChessEngine.getPsuedoMoveForPiece(board, i, toSq, promote);
                if (move) {
                    newBoard = ChessEngine.makeMove(board, move);
                    if (newBoard) {
                        return newBoard;
                    }
                }
            }
            return null;
        }

        let firstSqInRank: number = null;
        let lastSqInRank: number = null;

        // we have only rank
        if (fromRank !== -1) {
            firstSqInRank = (fromRank ^ 7) << 3;
            lastSqInRank = firstSqInRank + 7;
            for (let i = firstSqInRank; i <= lastSqInRank; i++) {
                move = ChessEngine.getPsuedoMoveForPiece(board, i, toSq, promote);
                if (move) {
                    newBoard = ChessEngine.makeMove(board, move);
                    if (newBoard) {
                        return newBoard;
                    }
                }
            }
            return null;
        }

        // we only have target square
        for (let i = 0; i < 64; i++) {
            if (board.pieceType[i] === piece && board.pieceColor[i] === board.side) {
                move = ChessEngine.getPsuedoMoveForPiece(board, i, toSq, promote);
                if (move) {
                    newBoard = ChessEngine.makeMove(board, move);
                    if (newBoard) {
                        return newBoard;
                    }
                }
            }
        }

        return null;
    }


    /**
     * in_check() returns TRUE if side s is in check and FALSE
     * otherwise. It just scans the board to find side s's king
     * and calls attack() to see if it's being attacked.
     */
    static isInCheck(board: Board, side: number): boolean {
        for (let i = 0; i < 64; ++i) {
            if (board.pieceType[i] === KING && board.pieceColor[i] === side) {
                return ChessEngine.isAttacked(board, i, side ^ 1);
            }
        }
        return true;
        /* shouldn't get here */
    }

    /**
     * attack() returns TRUE if square sq is being attacked by side s and FALSE
     * otherwise.
     */
    static isAttacked(board: Board, sq: number, bySide: number): boolean {
        for (let i = 0; i < 64; ++i) {
            if (board.pieceColor[i] === bySide) {
                if (board.pieceType[i] === PAWN) {
                    if (bySide === WHITE) {
                        if (ChessEngine.getFile(i) !== 0 && i - 9 === sq) {
                            return true;
                        }
                        if (ChessEngine.getFile(i) !== 7 && i - 7 === sq) {
                            return true;
                        }
                    } else {
                        if (ChessEngine.getFile(i) !== 0 && i + 7 === sq) {
                            return true;
                        }
                        if (ChessEngine.getFile(i) !== 7 && i + 9 === sq) {
                            return true;
                        }
                    }
                } else {
                    for (let j = 0; j < OFFSETS[board.pieceType[i]]; ++j) {
                        for (let n = i; ;) {
                            n = MAILBOX[MAILBOX64[n] + OFFSET[board.pieceType[i]][j]];
                            if (n === -1) {
                                break;
                            }
                            if (n === sq) {
                                return true;
                            }
                            if (board.pieceColor[n] !== EMPTY) {
                                break;
                            }
                            if (!SLIDE[board.pieceType[i]]) {
                                break;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Returns a psuedo move or null if really not allowed.
     *
     * TODO: fix promotion
     */
    static getPsuedoMoveForPiece(board: Board, fromSq: number, toSq: number, promPiece: number): PotentialMove {
        if (board.pieceColor[fromSq] !== board.side) {
            // not your turn or no piece there
            return null;
        }

        if (board.pieceType[fromSq] === PAWN) {
            if (board.side === WHITE) {
                if (ChessEngine.getFile(fromSq) !== 0 && board.pieceColor[fromSq - 9] === BLACK) {
                    if (toSq === fromSq - 9) {
                        return ChessEngine.createMove(fromSq, fromSq - 9, PAWN_MOVE_FLAG | CAPTURE_FLAG, promPiece);
                    }
                }
                if (ChessEngine.getFile(fromSq) !== 7 && board.pieceColor[fromSq - 7] === BLACK) {
                    if (toSq === fromSq - 7) {
                        return ChessEngine.createMove(fromSq, fromSq - 7, PAWN_MOVE_FLAG | CAPTURE_FLAG, promPiece);
                    }
                }
                if (board.pieceColor[fromSq - 8] === EMPTY) {
                    if (toSq === fromSq - 8) {
                        return ChessEngine.createMove(fromSq, fromSq - 8, 16, promPiece);
                    }
                    if (fromSq >= 48 && board.pieceColor[fromSq - 16] === EMPTY) {
                        if (toSq === fromSq - 16) {
                            return ChessEngine.createMove(fromSq, fromSq - 16, PAWN_MOVE_FLAG | DOUBLE_PAWN_FLAG, promPiece);
                        }
                    }
                }

                if (board.ep === toSq) {
                    if (ChessEngine.getFile(board.ep) !== 0 && board.pieceColor[board.ep + 7] === WHITE && board.pieceType[board.ep + 7] === PAWN) {
                        return ChessEngine.createMove(board.ep + 7, board.ep, CAPTURE_FLAG | PAWN_MOVE_FLAG | EN_PASSANT_FLAG, EMPTY); // added empty at the end?
                    }
                    if (ChessEngine.getFile(board.ep) !== 7 && board.pieceColor[board.ep + 9] === WHITE && board.pieceType[board.ep + 9] === PAWN) {
                        return ChessEngine.createMove(board.ep + 9, board.ep, CAPTURE_FLAG | PAWN_MOVE_FLAG | EN_PASSANT_FLAG, EMPTY); // added empty at the end?
                    }
                }


            } else {
                if (ChessEngine.getFile(fromSq) !== 0 && board.pieceColor[fromSq + 7] === WHITE) {
                    if (toSq === fromSq + 7) {
                        return ChessEngine.createMove(fromSq, fromSq + 7, PAWN_MOVE_FLAG | CAPTURE_FLAG, promPiece);
                    }
                }
                if (ChessEngine.getFile(fromSq) !== 7 && board.pieceColor[fromSq + 9] === WHITE) {
                    if (toSq === fromSq + 9) {
                        return ChessEngine.createMove(fromSq, fromSq + 9, PAWN_MOVE_FLAG | CAPTURE_FLAG, promPiece);
                    }
                }
                if (board.pieceColor[fromSq + 8] === EMPTY) {
                    if (toSq === fromSq + 8) {
                        return ChessEngine.createMove(fromSq, fromSq + 8, 16, promPiece);
                    }

                    if (fromSq <= 15 && board.pieceColor[fromSq + 16] === EMPTY) {
                        if (toSq === fromSq + 16) {
                            return ChessEngine.createMove(fromSq, fromSq + 16, PAWN_MOVE_FLAG | DOUBLE_PAWN_FLAG, promPiece);
                        }
                    }
                }

                if (board.ep === toSq) {
                    if (ChessEngine.getFile(board.ep) !== 0 && board.pieceColor[board.ep - 9] === BLACK && board.pieceType[board.ep - 9] === PAWN) {
                        return ChessEngine.createMove(board.ep - 9, board.ep, CAPTURE_FLAG | PAWN_MOVE_FLAG | EN_PASSANT_FLAG, EMPTY); // added empty at the end
                    }
                    if (ChessEngine.getFile(board.ep) !== 7 && board.pieceColor[board.ep - 7] === BLACK && board.pieceType[board.ep - 7] === PAWN) {
                        return ChessEngine.createMove(board.ep - 7, board.ep, CAPTURE_FLAG | PAWN_MOVE_FLAG | EN_PASSANT_FLAG, EMPTY); // // added empty at the end
                    }
                }

            }
        } else {
            for (let j = 0; j < OFFSETS[board.pieceType[fromSq]]; ++j) {
                for (let n = fromSq; ;) {
                    n = MAILBOX[MAILBOX64[n] + OFFSET[board.pieceType[fromSq]][j]];
                    if (n === -1) {
                        break;
                    }
                    if (board.pieceColor[n] !== EMPTY) {
                        if (board.pieceColor[n] === board.xside) {
                            if (toSq === n) {
                                return ChessEngine.createMove(fromSq, n, CAPTURE_FLAG, EMPTY); // added empty at the end?
                            }
                        }
                        break;
                    }
                    if (toSq === n) {
                        return ChessEngine.createMove(fromSq, n, 0, EMPTY); // added empty at the end?
                    }
                    if (!SLIDE[board.pieceType[fromSq]]) {
                        break;
                    }
                }
            }
        }

        /* generate castle moves */
        if (board.pieceType[fromSq] === KING) {
            if (board.side === WHITE) {
                if ((board.castle & 1) > 0) {
                    if (toSq === G1) {
                        return ChessEngine.createMove(E1, G1, CASTLE_FLAG, EMPTY); // added empty at the end?
                    }
                }
                if ((board.castle & 2) > 0) {
                    if (toSq === C1) {
                        return ChessEngine.createMove(E1, C1, CASTLE_FLAG, EMPTY); // added empty at the end?
                    }
                }
            } else {
                if ((board.castle & 4) > 0) {
                    if (toSq === G8) {
                        return ChessEngine.createMove(E8, G8, CASTLE_FLAG, EMPTY); // added empty at the end?
                    }
                }
                if ((board.castle & 8) > 0) {
                    if (toSq === C8) {
                        return ChessEngine.createMove(E8, C8, CASTLE_FLAG, EMPTY); // added empty at the end?
                    }
                }
            }
        }

        return null;
    }

    /* gen() generates pseudo-legal moves for the current position.
     It scans the board to find friendly pieces and then determines
     what squares they attack. When it finds a piece/square
     combination, it calls gen_push to put the move on the "move
     stack." */
    static getAllPossiblePsuedoMoves(board: Board): Array<PotentialMove> {
        const result: Array<PotentialMove> = [];

        for (let i = 0; i < 64; ++i) {
            if (board.pieceColor[i] === board.side) {
                if (board.pieceType[i] === PAWN) {
                    if (board.side === WHITE) {
                        if (ChessEngine.getFile(i) !== 0 && board.pieceColor[i - 9] === BLACK) {
                            ChessEngine.addPsuedoMove(board, result, i, i - 9, PAWN_MOVE_FLAG | CAPTURE_FLAG);
                        }
                        if (ChessEngine.getFile(i) !== 7 && board.pieceColor[i - 7] === BLACK) {
                            ChessEngine.addPsuedoMove(board, result, i, i - 7, PAWN_MOVE_FLAG | CAPTURE_FLAG);
                        }
                        if (board.pieceColor[i - 8] === EMPTY) {
                            ChessEngine.addPsuedoMove(board, result, i, i - 8, 16);
                            if (i >= 48 && board.pieceColor[i - 16] === EMPTY) {
                                ChessEngine.addPsuedoMove(board, result, i, i - 16, PAWN_MOVE_FLAG | DOUBLE_PAWN_FLAG);
                            }
                        }
                    } else {
                        if (ChessEngine.getFile(i) !== 0 && board.pieceColor[i + 7] === WHITE) {
                            ChessEngine.addPsuedoMove(board, result, i, i + 7, PAWN_MOVE_FLAG | CAPTURE_FLAG);
                        }
                        if (ChessEngine.getFile(i) !== 7 && board.pieceColor[i + 9] === WHITE) {
                            ChessEngine.addPsuedoMove(board, result, i, i + 9, PAWN_MOVE_FLAG | CAPTURE_FLAG);
                        }
                        if (board.pieceColor[i + 8] === EMPTY) {
                            ChessEngine.addPsuedoMove(board, result, i, i + 8, 16);
                            if (i <= 15 && board.pieceColor[i + 16] === EMPTY) {
                                ChessEngine.addPsuedoMove(board, result, i, i + 16, PAWN_MOVE_FLAG | DOUBLE_PAWN_FLAG);
                            }
                        }
                    }
                } else {
                    for (let j = 0; j < OFFSETS[board.pieceType[i]]; ++j) {
                        for (let n = i; ;) {
                            n = MAILBOX[MAILBOX64[n] + OFFSET[board.pieceType[i]][j]];
                            if (n === -1) {
                                break;
                            }
                            if (board.pieceColor[n] !== EMPTY) {
                                if (board.pieceColor[n] === board.xside) {
                                    ChessEngine.addPsuedoMove(board, result, i, n, CAPTURE_FLAG);
                                }
                                break;
                            }
                            ChessEngine.addPsuedoMove(board, result, i, n, 0);
                            if (!SLIDE[board.pieceType[i]]) {
                                break;
                            }
                        }
                    }
                }
            }
        }

        /* generate castle moves */
        if (board.side === WHITE) {
            if ((board.castle & 1) > 0) {
                ChessEngine.addPsuedoMove(board, result, E1, G1, CASTLE_FLAG);
            }
            if ((board.castle & 2) > 0) {
                ChessEngine.addPsuedoMove(board, result, E1, C1, CASTLE_FLAG);
            }
        } else {
            if ((board.castle & 4) > 0) {
                ChessEngine.addPsuedoMove(board, result, E8, G8, CASTLE_FLAG);
            }
            if ((board.castle & 8) > 0) {
                ChessEngine.addPsuedoMove(board, result, E8, C8, CASTLE_FLAG);
            }
        }

        /* generate en passant moves */
        if (board.ep !== -1) {
            if (board.side === WHITE) {
                if (ChessEngine.getFile(board.ep) !== 0 && board.pieceColor[board.ep + 7] === WHITE && board.pieceType[board.ep + 7] === PAWN) {
                    ChessEngine.addPsuedoMove(board, result, board.ep + 7, board.ep, CAPTURE_FLAG | PAWN_MOVE_FLAG | EN_PASSANT_FLAG);
                }
                if (ChessEngine.getFile(board.ep) !== 7 && board.pieceColor[board.ep + 9] === WHITE && board.pieceType[board.ep + 9] === PAWN) {
                    ChessEngine.addPsuedoMove(board, result, board.ep + 9, board.ep, CAPTURE_FLAG | PAWN_MOVE_FLAG | EN_PASSANT_FLAG);
                }
            } else {
                if (ChessEngine.getFile(board.ep) !== 0 && board.pieceColor[board.ep - 9] === BLACK && board.pieceType[board.ep - 9] === PAWN) {
                    ChessEngine.addPsuedoMove(board, result, board.ep - 9, board.ep, CAPTURE_FLAG | PAWN_MOVE_FLAG | EN_PASSANT_FLAG);
                }
                if (ChessEngine.getFile(board.ep) !== 7 && board.pieceColor[board.ep - 7] === BLACK && board.pieceType[board.ep - 7] === PAWN) {
                    ChessEngine.addPsuedoMove(board, result, board.ep - 7, board.ep, CAPTURE_FLAG | PAWN_MOVE_FLAG | EN_PASSANT_FLAG);
                }
            }
        }

        return result;
    };


    static addPsuedoMove(board: Board, result: Array<PotentialMove>, from: number, to: number, bits: number): void {
        if ((bits & 16) > 0) {
            if (board.side === WHITE) {
                if (to <= H8) {
                    ChessEngine.addPromotion(result, from, to, bits);
                    return;
                }
            } else {
                if (to >= A1) {
                    ChessEngine.addPromotion(result, from, to, bits);
                    return;
                }
            }
        }
        result.push(ChessEngine.createMove(from, to, bits, EMPTY)); // added empty at the end?
    }

    /* puts 4 moves on the move stack, one for each possible promotion piece */
    static addPromotion(result: Array<PotentialMove>, from: number, to: number, bits: number): void {
        for (let i = KNIGHT; i <= QUEEN; ++i) {
            result.push(ChessEngine.createMove(from, to, (bits | PROMOTE_FLAG), i));
        }
    }

    static makeMove(board: Board, m: PotentialMove): Board {
        var newBoard = ChessEngine.copyBoardUnfrozen(board);

        /* test to see if a castle move is legal and move the rook
         (the king is moved with the usual move code later) */
        if ((m.bits & 2) > 0) {
            let from: number = null;
            let to: number = null;

            if (ChessEngine.isInCheck(board, board.side)) {
                return null;
            }
            switch (m.to) {
                case 62:
                    if (board.pieceColor[F1] !== EMPTY || board.pieceColor[G1] !== EMPTY || ChessEngine.isAttacked(board, F1, board.xside) || ChessEngine.isAttacked(board, G1, board.xside)) {
                        return null;
                    }
                    from = H1;
                    to = F1;
                    break;
                case 58:
                    if (board.pieceColor[B1] !== EMPTY || board.pieceColor[C1] !== EMPTY || board.pieceColor[D1] !== EMPTY || ChessEngine.isAttacked(board, C1, board.xside) || ChessEngine.isAttacked(board, D1, board.xside)) {
                        return null;
                    }
                    from = A1;
                    to = D1;
                    break;
                case 6:
                    if (board.pieceColor[F8] !== EMPTY || board.pieceColor[G8] !== EMPTY || ChessEngine.isAttacked(board, F8, board.xside) || ChessEngine.isAttacked(board, G8, board.xside)) {
                        return null;
                    }
                    from = H8;
                    to = F8;
                    break;
                case 2:
                    if (board.pieceColor[B8] !== EMPTY || board.pieceColor[C8] !== EMPTY || board.pieceColor[D8] !== EMPTY || ChessEngine.isAttacked(board, C8, board.xside) || ChessEngine.isAttacked(board, D8, board.xside)) {
                        return null;
                    }
                    from = A8;
                    to = D8;
                    break;
                default:  /* shouldn't get here */
                    from = -1;
                    to = -1;
                    throw "failed to castle";
            }
            newBoard.pieceColor[to] = board.pieceColor[from];
            newBoard.pieceType[to] = board.pieceType[from];
            newBoard.pieceColor[from] = EMPTY;
            newBoard.pieceType[from] = EMPTY;
        }


        if (board.side === BLACK) {
            newBoard.fullmove = board.fullmove + 1;
        }

        /* update the castle, en passant, and
         fifty-move-draw variables */
        newBoard.castle = board.castle & (CASTLE_MASK[m.from] & CASTLE_MASK[m.to]);
        if ((m.bits & 8) > 0) {
            if (board.side === WHITE) {
                newBoard.ep = m.to + 8;
            } else {
                newBoard.ep = m.to - 8;
            }
        } else {
            newBoard.ep = -1;
        }
        if ((m.bits & (PAWN_MOVE_FLAG | CAPTURE_FLAG)) > 0) {
            newBoard.fifty = 0;
        } else {
            newBoard.fifty = board.fifty + 1;
        }

        /* move the piece */
        newBoard.pieceColor[m.to] = board.side;
        if ((m.bits & 32) > 0) {
            newBoard.pieceType[m.to] = m.promote;
        } else {
            newBoard.pieceType[m.to] = board.pieceType[m.from];
        }
        newBoard.pieceColor[m.from] = EMPTY;
        newBoard.pieceType[m.from] = EMPTY;

        /* erase the pawn if this is an en passant move */
        if ((m.bits & 4) > 0) {
            if (board.side === WHITE) {
                newBoard.pieceColor[m.to + 8] = EMPTY;
                newBoard.pieceType[m.to + 8] = EMPTY;
            } else {
                newBoard.pieceColor[m.to - 8] = EMPTY;
                newBoard.pieceType[m.to - 8] = EMPTY;
            }
        }

        /* switch sides and test for legality (if we can capture
         the other guy's king, it's an illegal position and
         we need to take the move back) */
        newBoard.side = board.side ^ 1;
        newBoard.xside = board.xside ^ 1;
        if (ChessEngine.isInCheck(board, board.xside)) {
            return null;
        }
        newBoard.check = ChessEngine.isInCheck(board, board.side);
        return newBoard;
    };

    /**
     * Returns true if the two boards have the same position. Where equality
     * forfills the rules for threefold repetition.
     *  */
    static equalPosition(board1: Board, board2: Board): boolean {
        if (board1 === null || board2 === null) {
            return false;
        }
        if (board1.castle !== board2.castle) {
            return false;
        }

        if (board1.ep !== board2.ep) {
            return false;
        }

        for (let i = 0; i < 64; i++) {
            if (board1.pieceColor[i] !== board2.pieceColor[i]) {
                return false;
            }
            if (board2.pieceType[i] !== board2.pieceType[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Parse SAN and returns result.
     *
     *
     * @param {type} san move in standard algebraic notation (SAN)
     */
    static parseSAN(san:string): ParsedSAN {
        let check = function(input: string, regexList: Array<string>): boolean {
            if (regexList.length !== input.length) {
                return false;
            }
            var regex = "";
            for (let i = 0; i < regexList.length; i++) {
                regex += regexList[i];
            }

            return !!input.match(new RegExp(regex));
        };

        var file = "[abcdefgh]",
            rank = "[12345678]",
            piece = "[KQRNB]",
            x = "x",
            eq = "=";

        let result: ParsedSAN = null;

        if (check(san, [piece, file, rank, x, file, rank])) {
            // Rc5xd5
            result = {
                piece: san.charAt(0),
                fromFile: san.charAt(1),
                fromRank: san.charAt(2),
                capture: true,
                toFile: san.charAt(4),
                toRank: san.charAt(5)
            };
        } else if (check(san, [piece, file, rank, file, rank])) {
            // Rc5d5
            result = {
                piece: san.charAt(0),
                fromFile: san.charAt(1),
                fromRank: san.charAt(2),
                toFile: san.charAt(3),
                toRank: san.charAt(4)
            };
        } else if (check(san, [piece, rank, x, file, rank])) {
            // Q5xd4
            result = {
                piece: san.charAt(0),
                fromRank: san.charAt(1),
                capture: true,
                toFile: san.charAt(3),
                toRank: san.charAt(4)
            };
        } else if (check(san, [piece, rank, file, rank])) {
            // Q5d4
            result = {
                piece: san.charAt(0),
                fromRank: san.charAt(1),
                toFile: san.charAt(2),
                toRank: san.charAt(3)
            };
        } else if (check(san, [piece, file, x, file, rank])) {
            // Rcxd5
            result = {
                piece: san.charAt(0),
                fromFile: san.charAt(1),
                capture: true,
                toFile: san.charAt(3),
                toRank: san.charAt(4)
            };
        } else if (check(san, [piece, file, file, rank])) {
            // Rcd5
            result = {
                piece: san.charAt(0),
                fromFile: san.charAt(1),
                toFile: san.charAt(2),
                toRank: san.charAt(3)
            };
        } else if (check(san, [piece, x, file, rank])) {
            // Bxe2
            result = {
                piece: san.charAt(0),
                capture: true,
                toFile: san.charAt(2),
                toRank: san.charAt(3)
            };
        } else if (check(san, [piece, file, rank])) {
            // Be2
            result = {
                piece: san.charAt(0),
                toFile: san.charAt(1),
                toRank: san.charAt(2)
            };
        } else if (check(san, [file, x, file, rank, eq, piece])) {
            // exf8=Q
            result = {
                fromFile: san.charAt(0),
                capture: true,
                toFile: san.charAt(2),
                toRank: san.charAt(3),
                promPiece: san.charAt(5)
            };
        } else if (check(san, [file, x, file, rank])) {
            // fxe4
            result = {
                fromFile: san.charAt(0),
                capture: true,
                toFile: san.charAt(2),
                toRank: san.charAt(3)
            };
        } else if (check(san, [file, rank, eq, piece])) {
            // e8=Q
            result = {
                toFile: san.charAt(0),
                toRank: san.charAt(1),
                promPiece: san.charAt(3)
            };
        } else if (check(san, [file, rank])) {
            // e4
            result = {
                toFile: san.charAt(0),
                toRank: san.charAt(1)
            };
        } else if (san === "O-O") {
            result = {
                castle: "K"
            };
        } else if (san === "O-O-O") {
            result = {
                castle: "Q"
            };
        }

        return result;
    }

    static parseFEN(fen:string): Board {
        var columns = fen.split(" ");
        if (columns.length !== 6) {
            throw "expected 6 columns in FEN";
        }

        let board: Board = ChessEngine.createBoard();

        ChessEngine.parseFENMoves(board, columns[0]);

        switch (columns[1]) {
            case "w":
                board.side = WHITE;
                board.xside = BLACK;
                break;
            case "b":
                board.side = BLACK;
                board.xside = WHITE;
                break;
            default:
                throw "Unexpected active color: " + columns[1];
        }

        if (columns[2] === "-") {
            board.castle = 0;
        } else {
            board.castle = 0;
            for (let i = 0; i < columns[2].length; i++) {
                let c = columns[2][i];
                switch (c) {
                    case "K":
                        board.castle |= CASTLE_WHITE_KING_FLAG;
                        break;
                    case "Q":
                        board.castle |= CASTLE_WHITE_QUEEN_FLAG;
                        break;
                    case "k":
                        board.castle |= CASTLE_BLACK_KING_FLAG;
                        break;
                    case "q":
                        board.castle |= CASTLE_BLACK_QUEEN_FLAG;
                        break;
                    default:
                        throw "Unexpected character in castling availability: " + c;
                }
            }
        }

        if (columns[3] === "-") {
            board.ep = -1;
        } else {
            board.ep = ChessEngine.getSquare(columns[3].charCodeAt(0) - 97, columns[3].charCodeAt(1) - 49);
        }

        board.fifty = parseInt(columns[4]);
        board.fullmove = parseInt(columns[5]);
        board.check = ChessEngine.isInCheck(board, board.side);

        return board;
    }

    static parseFENMoves(board: Board, str: string): void {
        var ranks = str.split("/");
        if (ranks.length !== 8) {
            throw "Expected 8 rows in position, got " + ranks.length;
        }

        board.pieceColor = [];
        board.pieceType = [];

        for (let i = 0; i < 64; i++) {
            board.pieceColor[i] = EMPTY;
            board.pieceType[i] = EMPTY;
        }


        for (let i = 0; i < ranks.length; i++) {
            let rank = 7 - i;
            let file = 0;
            for (let n = 0; n < ranks[i].length; n++) {
                let c = ranks[i].charAt(n);
                let pos = ChessEngine.getSquare(file, rank);
                switch (c) {
                    case "p":
                        board.pieceColor[pos] = BLACK;
                        board.pieceType[pos] = PAWN;
                        file++;
                        break;
                    case "n":
                        board.pieceColor[pos] = BLACK;
                        board.pieceType[pos] = KNIGHT;
                        file++;
                        break;
                    case "b":
                        board.pieceColor[pos] = BLACK;
                        board.pieceType[pos] = BISHOP;
                        file++;
                        break;
                    case "r":
                        board.pieceColor[pos] = BLACK;
                        board.pieceType[pos] = ROOK;
                        file++;
                        break;
                    case "q":
                        board.pieceColor[pos] = BLACK;
                        board.pieceType[pos] = QUEEN;
                        file++;
                        break;
                    case "k":
                        board.pieceColor[pos] = BLACK;
                        board.pieceType[pos] = KING;
                        file++;
                        break;
                    case "P":
                        board.pieceColor[pos] = WHITE;
                        board.pieceType[pos] = PAWN;
                        file++;
                        break;
                    case "N":
                        board.pieceColor[pos] = WHITE;
                        board.pieceType[pos] = KNIGHT;
                        file++;
                        break;
                    case "B":
                        board.pieceColor[pos] = WHITE;
                        board.pieceType[pos] = BISHOP;
                        file++;
                        break;
                    case "R":
                        board.pieceColor[pos] = WHITE;
                        board.pieceType[pos] = ROOK;
                        file++;
                        break;
                    case "Q":
                        board.pieceColor[pos] = WHITE;
                        board.pieceType[pos] = QUEEN;
                        file++;
                        break;
                    case "K":
                        board.pieceColor[pos] = WHITE;
                        board.pieceType[pos] = KING;
                        file++;
                        break;
                    case "1":
                    case "2":
                    case "3":
                    case "4":
                    case "5":
                    case "6":
                    case "7":
                    case "8":
                        file += ChessEngine.cdiff(c, "0");
                        break;
                    default:
                        throw "Unexpected character: '" + c + "'";
                }
            }
        }
    }
}


export class ChessMoveGenerator implements MoveGenerator {

    first(initialBoard: string): Context {
        if(initialBoard === null) {
            initialBoard = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        }
        let board = ChessEngine.parseFEN(initialBoard);
        return {
            board: ChessEngine.toFEN(board),
            allowedMoves: ChessEngine.getPossibleMoves(board).map(native => ({"san": native.san, "lan": native.lan})),
            sideToMove: ChessEngine.getNextPlayer(board),
            message: null
        };
    }

    move(context: Context, move: Move): Context {
        let board = ChessEngine.move(ChessEngine.parseFEN(context.board), move);
        return {
            board: ChessEngine.toFEN(board),
            allowedMoves: ChessEngine.getPossibleMoves(board).map(native => ({"san": native.san, "lan": native.lan})),
            sideToMove: ChessEngine.getNextPlayer(board),
            message: null
        };
    }
}


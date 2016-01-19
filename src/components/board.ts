/**
 * Created by Richard on 2016-01-16.
 */

import {Component, ViewChild, ElementRef, Input, HostListener} from "angular2/core";
import {AfterViewInit, OnChanges, SimpleChange} from "angular2/core";

interface Square {
    x: number;
    y: number;
    width: number;
    height: number;
    white: boolean;
    pos: string;
    piece: string;
}

interface Point {
    x: number;
    y: number;
}

class Layout {
    x: number;
    y: number;
    width: number;
    height: number;    
    //squares: { [key: string]: Square } = {};
    squares: Array<Square>;
    size: number;
    
    constructor() {
        const sq = ["wa8", "bb8", "wc8", "bd8", "we6", "bf8", "wg8", "bh8",
                    "ba7", "wb7", "bc7", "wd7", "be6", "wf7", "bg7", "wh7",
                    "wa6", "bb6", "wc6", "bd6", "we6", "bf6", "wg6", "bh6",
                    "ba5", "wb5", "bc5", "wd5", "be6", "wf5", "bg5", "wh5",
                    "wa4", "bb4", "wc4", "bd4", "we6", "bf4", "wg4", "bh4",
                    "ba3", "wb3", "bc3", "wd3", "be6", "wf3", "bg3", "wh3",
                    "wa2", "bb8", "wc8", "bd8", "we6", "bf8", "wg8", "bh8",
                    "ba1", "wb1", "bc1", "wd1", "be6", "wf1", "bg1", "wh1"];
        this.squares = sq.map(s => { return {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                white: s.charAt(0) === "w",
                pos: s.substring(1),
                piece: ""
        }});
    }

    doLayout(maxWidth: number, maxHeight: number) {
        this.size = Math.min(maxWidth / 8, maxHeight / 8);
        this.width = this.size * 8;
        this.height = this.size * 8;
        const hMargin = maxWidth - this.width ,
              vMargin = maxHeight - this.height;
        this.x = hMargin / 2;
        this.y = vMargin / 2;

        let px = this.x, py = this.y - this.size;
        for(let i = 0; i < 64; i++) {
            if(i % 8 == 0) {
                px = this.x;
                py = py + this.size;
            }
            this.squares[i].x = px;
            this.squares[i].y = py;
            this.squares[i].width = this.size;
            this.squares[i].height = this.size;

            px += this.size;
        }
    }
}

class Theme {
    private pieceImages: { [key: string]: HTMLImageElement } = {};
    private piecesPromise: Promise<any>;
    private white: HTMLImageElement = new Image();
    private black: HTMLImageElement = new Image();

    constructor() {
        const names = [
            { name: "b", file: "black-bishop.svg" },
            { name: "k", file: "black-king.svg"},
            { name: "n", file: "black-knight.svg"},
            { name: "p", file: "black-pawn.svg"},
            { name: "q", file: "black-queen.svg"},
            { name: "r", file: "black-rook.svg"},
            { name: "B", file: "white-bishop.svg"},
            { name: "K", file: "white-king.svg"},
            { name: "N", file: "white-knight.svg"},
            { name: "P", file: "white-pawn.svg"},
            { name: "Q", file: "white-queen.svg"},
            { name: "R", file: "white-rook.svg"}
        ];

        let promises = names.map(piece => {
            const img = new Image();
            this.pieceImages[piece.name] = img;
            return new Promise((resolve, reject) => {
                img.onload = (evt) => resolve({ name: piece.name, element: img});
                img.onerror = (evt) => reject({ name: piece.name, element: img});
                img.src = "resources/pieces/" + piece.file;
            });
        });

        promises.push(new Promise((resolve, reject) => {
            this.white.onload = (evt) => resolve({ name: "white", element: this.white});
            this.white.onerror = (evt) => reject({ name: "white", element: this.white});
            this.white.src = "resources/pieces/white.svg";
        }));

        promises.push(new Promise((resolve, reject) => {
            this.black.onload = (evt) => resolve({ name: "white", element: this.white});
            this.black.onerror = (evt) => reject({ name: "white", element: this.white});
            this.black.src = "resources/pieces/black.svg";
        }));

        this.piecesPromise = Promise.all(promises);
    }

    getPieceImage(name: string): HTMLImageElement {
        return this.pieceImages[name];
    }

    getBackgroundImage(white: boolean): HTMLImageElement {
        return white ? this.white : this.black;
    }

    loaded(): Promise<any> {
        return this.piecesPromise;
    }
}

@Component({
    selector: "board",
    templateUrl: "src/components/board.html",
    styleUrls: ["src/components/board.css"]
})
export class BoardComponent implements AfterViewInit, OnChanges {
    @Input()
    private fen: string;

    @ViewChild("canvas")
    private canvasElement: ElementRef;
    private ctx: CanvasRenderingContext2D;

    private layout: Layout = new Layout();
    private theme: Theme = new Theme();

    private mousePressedAt: Point = null;
    private mousePressedOn: Square = null;
    private dragging: boolean = false;
    private selected: Square = null;
    private draggedPiece: string = null;
    private draggedPieceAt: Point = null;

    private canvasWidth: number = 640;
    private canvasHeight: number = 480;

    static DRAG_THRESHOLD = 3;

    constructor() {
        let worker = new Worker("node_modules/stockfish/src/stockfish.js");
        worker.onmessage = function(evt) {
            console.log(evt.data);
        };
        worker.postMessage("d");
    }

    @HostListener("window:resize", ["$event"])
    public onResize(evt: Event) {
        this._adjustCanvasSize();
    }

    public onMouseMove(evt: MouseEvent) {
        if(this.mousePressedAt !== null && !this.dragging) {
            const dx = evt.offsetX - this.mousePressedAt.x,
                  dy = evt.offsetY - this.mousePressedAt.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if(dist > BoardComponent.DRAG_THRESHOLD) {
                this.dragging = true;
                this._onMouseDragStart(evt);
            }
        }

        if(this.dragging) {
            this._onMouseDragged(evt);
        }
    }

    public onMouseDown(evt: MouseEvent) {
        evt.preventDefault();
        this.mousePressedOn = this._getSquare(evt);
        if(this.mousePressedOn !== null) {
            this.mousePressedAt = {x: evt.offsetX, y: evt.offsetY};
        }
        this.dragging = false;
    }

    public onMouseUp(evt: MouseEvent) {
        evt.preventDefault();

        if(this.dragging) {
            this._onMouseDragStop(evt);
        } else {
            this._onMouseClicked(evt);
        }

        this.mousePressedAt = null;
        this.dragging = false;
    }

    public onContextMenu(evt: MouseEvent) {
        evt.preventDefault();
    }

    public ngAfterViewInit() {
        this.ctx = this.canvasElement.nativeElement.getContext("2d");
        this._adjustCanvasSize();
    }

    public ngOnChanges(changes: { [key: string]: SimpleChange;}): any {
        if("fen" in changes) {
            this._updatePieces();
            this.theme.loaded().then(_ => {
                this._paint();
            });
        }
    }

    private _onMouseDragStart(evt: MouseEvent): void {
        if(this.mousePressedOn.piece !== "") {
            this.draggedPiece = this.mousePressedOn.piece;
            this.draggedPieceAt = {x: evt.offsetX, y: evt.offsetY};
            this.mousePressedOn.piece = "";
            this._paint();
        }
    }

    private _onMouseDragged(evt: MouseEvent): void {
        if(this.draggedPiece !== null) {
            this.draggedPieceAt = {x: evt.offsetX, y: evt.offsetY};
            //requestAnimationFrame(this._paint.bind(this));
            this._paint();
        }
    }

    private _onMouseDragStop(evt: MouseEvent): void {
        if(this.draggedPiece !== null) {
            const square = this._getSquare(evt);
            if(square != null) {
                square.piece = this.draggedPiece;
            } else {
                this.mousePressedOn.piece = this.draggedPiece;
            }
            this.draggedPiece = null;
            this.draggedPieceAt = null;
            this._paint();
        }
    }

    private _onMouseClicked(evt: MouseEvent): void {
        const square = this._getSquare(evt);

        if(this.selected != null) {
            square.piece = this.selected.piece;
            this.selected.piece = "";
            this.selected = null;
        } else {
            this.selected = null;
            if (square != null) {
                if (square.piece !== "") {
                    this.selected = square;
                }
            }
        }
        this._paint();
    }

    private _adjustCanvasSize(): void {
        const parent = this.canvasElement.nativeElement.parentElement;
        this.canvasWidth = parent.offsetWidth - 1;
        this.canvasHeight = parent.offsetHeight - 1;
        this.canvasElement.nativeElement.width = this.canvasWidth;
        this.canvasElement.nativeElement.height = this.canvasHeight;
        this.layout.doLayout(this.canvasWidth, this.canvasHeight);
        requestAnimationFrame(this._paint.bind(this));
    }

    private _getSquare(evt: MouseEvent): Square {
        return this._getSquareAt(evt.offsetX, evt.offsetY);
    }
    private _getSquareAt(x: number, y: number): Square {
        for(let i = 0; i < this.layout.squares.length; i++) {
            const square = this.layout.squares[i];
            if(square.x <= x && square.y <= y && square.x + square.width >= x && square.y + square.height >= y) {
                return square;
            }
        }
        return null;
    }


    private _updatePieces(): void {
        for(let i = 0, idx = 0; i < this.fen.length && this.fen.charAt(i) !== " "; i++) {
            const c = this.fen.charAt(i);
            if(!isNaN(parseInt(c))) {
                for(let n = 0; n < parseInt(c); n++) {
                    this.layout.squares[idx].piece = "";
                    idx += 1;
                }
            } else if(c !== "/") {
                this.layout.squares[idx].piece = c;
                idx += 1;
            } else {
                this.layout.squares[idx].piece = "";
            }
        }
    }

    private _paint(): void {
        this._paintBackground();
        this._paintPieces();
        this._paintSelections();
        this._paintDraggedPiece();
    }

    private _paintBackground(): void {
        if(this.ctx) {
            this.ctx.fillStyle = "rgb(255, 255, 255)";
            this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

            this.layout.squares.forEach(square => {
                const img = this.theme.getBackgroundImage(square.white);
                this.ctx.drawImage(img, square.x, square.y, square.width+1, square.height+1);
            });
        }
    }

    private _paintPieces(): void {
        for(let idx = 0; idx < this.layout.squares.length; idx++) {
            const square = this.layout.squares[idx];
            if(square.piece !== "") {
                const img = this.theme.getPieceImage(square.piece);
                this.ctx.drawImage(img, square.x, square.y, square.width, square.height);
            }
        }
    }

    private _paintSelections(): void {
        if(this.selected !== null) {
            this.ctx.fillStyle = "rgb(255, 0, 0)";
            this.ctx.strokeRect(this.selected.x, this.selected.y, this.selected.width, this.selected.height);
        }
    }

    private _paintDraggedPiece(): void {
        if(this.draggedPiece != null) {
            const img = this.theme.getPieceImage(this.draggedPiece);
            const x = this.draggedPieceAt.x - this.layout.size / 2,
                  y = this.draggedPieceAt.y - this.layout.size / 2;
            this.ctx.drawImage(img, x, y, this.layout.size, this.layout.size);
        }
    }
}
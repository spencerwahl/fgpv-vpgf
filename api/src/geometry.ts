/**
 * Represents a geographical point in decimal degrees.
 */
export class XY {
    /** Longitude in decimal degrees, bounded by ±360° */
    x: number;
    /** Latitude in decimal degrees, bounded by ±90° */
    y: number;

    constructor(x: number, y: number) {
        x = x <= 180 && x >= -180 ? x : 360 % Math.abs(x) * (x < 0 ? 1 : -1);

        if (x > 180 || x < -180) {
            throw new Error(`Longitude (x) provided is bounded to ±180°, ${x} given.`);
        } else if (y > 90 || y < -90) {
            throw new Error(`Latitude (y) provided is bounded to ±90°, ${y} given.`);
        }

        this.x = x;
        this.y = y;
    }

    /**
     * Returns true if both this and the provided `XY` instance have identical x` and `y` values.
     *
     * @param otherXY - Another `XY` instance for comparison
     */
    equals(otherXY: XY): boolean {
        return this.x === otherXY.x && this.y === otherXY.y;
    }

    /**
     * Returns a string of the form `y,x` for the current values of x and y.
     *
     * @param precision - The amount of decimal places for rounding
     */
    urlValue(precision: number = 6): string {
        return `${this.y.toFixed(precision)},${this.x.toFixed(precision)}`;
    };

    /**
     * Returns a string of the form `y,x` for the current values of x and y, rounded to 6 decimal places.
     */
    toString(): string {
        return this.urlValue();
    }
}

/** Represents a rectangular geographical area with a north-east and south-west boundary definition (x, y) in decimal degrees.
 *
 * ```text
 * +--------NE
 * |         |
 * |         |
 * |         |
 * SW--------+
 * ```
 *
 * @example #### Check if two `XYBounds` intersect
 *
 * ```js
 * const ne = new RV.GEO.XY(150, 65);
 * const sw = new RV.GEO.XY(100, 30);
 *
 * const b1 = new RV.GEO.XYBounds(ne, sw);
 * const b2 = new RV.GEO.XYBounds([170, 35], [90, -60]); // an [x, y] tuple works too
 *
 * console.log(b1.intersects(b2)); // true
 * ```
 *
 */
export class XYBounds {

    center: XY;
    northEast: XY;
    southWest: XY;

    constructor(northEast: XY | XYLiteral, southWest: XY | XYLiteral) {
        if (isXYLiteral(southWest)) {
            this.southWest = new XY(southWest[0], southWest[1]);
        } else {
            this.southWest = southWest;
        }

        if (isXYLiteral(northEast)) {
            this.northEast = new XY(northEast[0], northEast[1]);
        } else {
            this.northEast = northEast;
        }

        const centerX = this.southWest.x + ((this.northEast.x - this.southWest.x)/2);
        const centerY = this.southWest.y + ((this.northEast.y - this.southWest.y)/2);
        this.center = new XY(centerX, centerY);
    }

    /** Returns true if the given XY point is contained within this boundary. */
    contains(xy: XY): boolean {
        return xy.x >= this.southWest.x && xy.x <= this.northEast.x && xy.y >= this.southWest.y && xy.y <= this.northEast.y;
    }

    /** Returns true if this boundary is equal geographically to the other XYBounds provided. */
    equals(otherXYBounds: XYBounds): boolean {
        return this.northEast.x === otherXYBounds.northEast.x &&
            this.northEast.y === otherXYBounds.northEast.y &&
            this.southWest.x === otherXYBounds.southWest.x &&
            this.southWest.y === otherXYBounds.southWest.y;
    }

    /** Returns true if this boundary intersects with the other XYBounds provided. */
    intersects(otherXYBounds: XYBounds): boolean {
        return !(this.southWest.x > otherXYBounds.northEast.x ||
            this.northEast.x < otherXYBounds.southWest.x ||
            this.southWest.y > otherXYBounds.northEast.y ||
            this.northEast.y < otherXYBounds.southWest.y);
    }

    /**
     * Returns the bounds in the form "x_lo,y_lo,x_hi,y_hi".
     */
    toString(): string {
        return `${this.southWest.x},${this.southWest.y},${this.northEast.x},${this.northEast.y}`;
    }
}

export interface XYLiteral {
    0: number,
    1: number
}

export function isXYLiteral(x: any): x is XYLiteral {
    return x.length === 2;
}
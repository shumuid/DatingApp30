export class DemoTileOrganizer {
    private static MAX_TILES = 16;
    private tiles: { [id: number]: number } = {};
    public tileStates: { [id: number]: boolean } = {};
    acquireTileIndex(tileId: number): number {
      for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
        if (this.tiles[index] === tileId) {
          return index;
        }
      }
      for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
        if (!(index in this.tiles)) {
          this.tiles[index] = tileId;
          return index;
        }
      }
      throw new Error('no tiles are available');
    }
    releaseTileIndex(tileId: number): number {
      for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
        if (this.tiles[index] === tileId) {
          delete this.tiles[index];
          return index;
        }
      }
      return DemoTileOrganizer.MAX_TILES;
    }
  }
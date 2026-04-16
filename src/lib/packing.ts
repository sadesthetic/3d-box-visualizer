export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface PackedItem {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
}

export interface PackingResult {
  count: number;
  items: PackedItem[];
  efficiency: number;
  waste: number;
  orientation: Dimensions;
  layout: [number, number, number];
}

interface Space {
  l: number; w: number; h: number;
  x: number; y: number; z: number;
}

export function calculateBestPacking(item: Dimensions, container: Dimensions): PackingResult {
  const iL = item.length;
  const iW = item.width;
  const iH = item.height;
  const cL = container.length;
  const cW = container.width;
  const cH = container.height;

  if ([iL, iW, iH, cL, cW, cH].some(v => v <= 0)) {
    return {
      count: 0, items: [], efficiency: 0, waste: 0,
      orientation: { length: iL, width: iW, height: iH },
      layout: [0, 0, 0]
    };
  }

  const orientations = [
    [iL, iW, iH], [iL, iH, iW],
    [iW, iL, iH], [iW, iH, iL],
    [iH, iL, iW], [iH, iW, iL]
  ];

  let absoluteBestItems: PackedItem[] = [];
  let absoluteBestOri = orientations[0];
  let absoluteBestLayout: [number, number, number] = [0, 0, 0];

  // Evaluate each orientation as the primary filling strategy
  for (const primaryOri of orientations) {
    const spaces: Space[] = [{ l: cL, w: cW, h: cH, x: 0, y: 0, z: 0 }];
    const currentItems: PackedItem[] = [];
    let isFirstSpace = true;
    let baseLayout: [number, number, number] = [0, 0, 0];

    while (spaces.length > 0) {
      // Pop the largest space by volume
      spaces.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h));
      const space = spaces.shift()!;

      let bestSpaceOri = null;
      let maxSpaceItems = 0;
      let spaceArrangement = [0, 0, 0];

      // For the very first space, force the primary orientation, 
      // for the remaining sub-spaces, greedily find the best orientation that fits
      const orisToTest = isFirstSpace ? [primaryOri] : orientations;

      for (const ori of orisToTest) {
        const nx = Math.floor(space.l / ori[0]);
        const ny = Math.floor(space.w / ori[1]);
        const nz = Math.floor(space.h / ori[2]);
        const total = nx * ny * nz;
        if (total > maxSpaceItems) {
          maxSpaceItems = total;
          bestSpaceOri = ori;
          spaceArrangement = [nx, ny, nz];
        }
      }

      if (maxSpaceItems > 0 && bestSpaceOri) {
        const [nx, ny, nz] = spaceArrangement;
        const [l, w, h] = bestSpaceOri;

        if (isFirstSpace) {
          baseLayout = [nx, ny, nz];
        }

        // Add packed items
        for (let ix = 0; ix < nx; ix++) {
          for (let iy = 0; iy < ny; iy++) {
            for (let iz = 0; iz < nz; iz++) {
              currentItems.push({
                x: space.x + ix * l,
                y: space.y + iy * w,
                z: space.z + iz * h,
                dx: l,
                dy: w,
                dz: h
              });
            }
          }
        }

        // Guillotine split into 3 remaining spaces
        const usedL = nx * l;
        const usedW = ny * w;
        const usedH = nz * h;

        // Space 1: Rest of L
        if (space.l - usedL > 0) {
          spaces.push({
            l: space.l - usedL, w: space.w, h: space.h,
            x: space.x + usedL, y: space.y, z: space.z
          });
        }
        // Space 2: Rest of W
        if (space.w - usedW > 0) {
          spaces.push({
            l: usedL, w: space.w - usedW, h: space.h,
            x: space.x, y: space.y + usedW, z: space.z
          });
        }
        // Space 3: Rest of H
        if (space.h - usedH > 0) {
          spaces.push({
            l: usedL, w: usedW, h: space.h - usedH,
            x: space.x, y: space.y, z: space.z + usedH
          });
        }
      }
      isFirstSpace = false;
    }

    if (currentItems.length > absoluteBestItems.length) {
      absoluteBestItems = currentItems;
      absoluteBestOri = primaryOri;
      absoluteBestLayout = baseLayout;
    }
  }

  const itemVol = iL * iW * iH;
  const contVol = cL * cW * cH;
  const totalUsedVol = absoluteBestItems.length * itemVol;
  const efficiency = (totalUsedVol / contVol) * 100;
  const waste = contVol - totalUsedVol;

  return {
    count: absoluteBestItems.length,
    items: absoluteBestItems,
    orientation: {
      length: absoluteBestOri[0],
      width: absoluteBestOri[1],
      height: absoluteBestOri[2]
    },
    layout: absoluteBestLayout,
    efficiency,
    waste
  };
}


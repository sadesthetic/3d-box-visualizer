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
  // Secondary boxes support
  secondaryItems?: PackedItem[];
  secondaryCount?: number;
  secondaryItemVol?: number;
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
export function calculatePackingWithSecondary(
  primary: Dimensions, 
  secondary: Dimensions, 
  container: Dimensions
): PackingResult {
  // Step 1: Run standard packing for primary boxes
  const primaryResult = calculateBestPacking(primary, container);
  
  // If no secondary dimensions, just return primary
  if (secondary.length <= 0 || secondary.width <= 0 || secondary.height <= 0) {
    return primaryResult;
  }

  // Step 2: Identify where the remaining space is
  // We use the best orientation found in primaryResult
  const pOri = [primaryResult.orientation.length, primaryResult.orientation.width, primaryResult.orientation.height];
  const cL = container.length;
  const cW = container.width;
  const cH = container.height;

  // We need the spaces left after primaryResult
  // The algorithm already does this, but we need to stop before primaryResult finishes
  // and then start packing secondary.
  
  // Re-run the best orientation pass
  const spaces: Space[] = [{ l: cL, w: cW, h: cH, x: 0, y: 0, z: 0 }];
  const primaryItems: PackedItem[] = [];
  const secondaryItems: PackedItem[] = [];
  let isFirstSpace = true;

  const sOris = [
    [secondary.length, secondary.width, secondary.height],
    [secondary.length, secondary.height, secondary.width],
    [secondary.width, secondary.length, secondary.height],
    [secondary.width, secondary.height, secondary.length],
    [secondary.height, secondary.length, secondary.width],
    [secondary.height, secondary.width, secondary.length]
  ];

  while (spaces.length > 0) {
    spaces.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h));
    const space = spaces.shift()!;

    // Try primary
    const nxP = Math.floor(space.l / pOri[0]);
    const nyP = Math.floor(space.w / pOri[1]);
    const nzP = Math.floor(space.h / pOri[2]);
    const totalP = nxP * nyP * nzP;

    if (totalP > 0 && isFirstSpace) {
      // Pack primary
      for (let ix = 0; ix < nxP; ix++) {
        for (let iy = 0; iy < nyP; iy++) {
          for (let iz = 0; iz < nzP; iz++) {
            primaryItems.push({
              x: space.x + ix * pOri[0],
              y: space.y + iy * pOri[1],
              z: space.z + iz * pOri[2],
              dx: pOri[0], dy: pOri[1], dz: pOri[2]
            });
          }
        }
      }
      // Split
      const uL = nxP * pOri[0]; const uW = nyP * pOri[1]; const uH = nzP * pOri[2];
      if (space.l - uL > 0) spaces.push({ l: space.l - uL, w: space.w, h: space.h, x: space.x + uL, y: space.y, z: space.z });
      if (space.w - uW > 0) spaces.push({ l: uL, w: space.w - uW, h: space.h, x: space.x, y: space.y + uW, z: space.z });
      if (space.h - uH > 0) spaces.push({ l: uL, w: uW, h: space.h - uH, x: space.x, y: space.y, z: space.z + uH });
      isFirstSpace = false;
    } else {
      // Try secondary in this space
      let bestSOri = null;
      let maxS = 0;
      let sArr = [0,0,0];
      for (const ori of sOris) {
        const nx = Math.floor(space.l / ori[0]);
        const ny = Math.floor(space.w / ori[1]);
        const nz = Math.floor(space.h / ori[2]);
        const total = nx * ny * nz;
        if (total > maxS) { maxS = total; bestSOri = ori; sArr = [nx, ny, nz]; }
      }
      if (maxS > 0 && bestSOri) {
        for (let ix = 0; ix < sArr[0]; ix++) {
          for (let iy = 0; iy < sArr[1]; iy++) {
            for (let iz = 0; iz < sArr[2]; iz++) {
              secondaryItems.push({
                x: space.x + ix * bestSOri[0],
                y: space.y + iy * bestSOri[1],
                z: space.z + iz * bestSOri[2],
                dx: bestSOri[0], dy: bestSOri[1], dz: bestSOri[2]
              });
            }
          }
        }
        // Further split for more secondary if possible
        const uL = sArr[0] * bestSOri[0]; const uW = sArr[1] * bestSOri[1]; const uH = sArr[2] * bestSOri[2];
        if (space.l - uL > 0) spaces.push({ l: space.l - uL, w: space.w, h: space.h, x: space.x + uL, y: space.y, z: space.z });
        if (space.w - uW > 0) spaces.push({ l: uL, w: space.w - uW, h: space.h, x: space.x, y: space.y + uW, z: space.z });
        if (space.h - uH > 0) spaces.push({ l: uL, w: uW, h: space.h - uH, x: space.x, y: space.y, z: space.z + uH });
      }
    }
  }

  const pVol = primary.length * primary.width * primary.height;
  const sVol = secondary.length * secondary.width * secondary.height;
  const cVol = cL * cW * cH;
  const totalUsed = (primaryItems.length * pVol) + (secondaryItems.length * sVol);

  return {
    ...primaryResult,
    count: primaryItems.length,
    items: primaryItems,
    secondaryItems: secondaryItems,
    secondaryCount: secondaryItems.length,
    secondaryItemVol: sVol,
    efficiency: (totalUsed / cVol) * 100,
    waste: cVol - totalUsed
  };
}

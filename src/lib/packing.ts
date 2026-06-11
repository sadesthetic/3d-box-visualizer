export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface PackedItem {
  x: number;
  y: number;
  z: number;
  dx: number;          // Padded dimensions (including margin, used for spacing/layout)
  dy: number;
  dz: number;
  originalDx: number;  // Actual dimensions (used for rendering without margin)
  originalDy: number;
  originalDz: number;
  type: 1 | 2;         // 1: Primary item, 2: Secondary item
}

export interface PackingResult {
  count: number;
  count1: number;
  count2: number;
  items: PackedItem[];
  efficiency: number;
  waste: number;
  orientation: Dimensions;
  orientation2?: Dimensions;
  layout: [number, number, number];
  layout2?: [number, number, number];
}

export interface PackingOptions {
  item2?: Dimensions;
  maxVolume1?: number; // In volumeUnit, 0 or undefined means unlimited
  maxVolume2?: number; // In volumeUnit, 0 or undefined means unlimited
  volumeUnit?: 'ft3' | 'cm3' | 'm3';
  containerUnit: 'in' | 'cm' | 'ft';
  distributionMode?: 'optimal' | 'split' | 'x-first' | 'y-first' | 'z-first';
  errorMargin?: boolean;
}

interface Space {
  l: number; w: number; h: number;
  x: number; y: number; z: number;
}

// Convert volume from source unit to container unit volume (in3, cm3, or ft3)
function convertVolumeToContainerUnit(
  vol: number,
  volUnit: 'ft3' | 'cm3' | 'm3',
  containerUnit: 'in' | 'cm' | 'ft'
): number {
  if (vol <= 0) return Infinity;

  // Convert input volume to cm3 first
  let cm3 = vol;
  if (volUnit === 'ft3') cm3 = vol * 28316.846592;
  else if (volUnit === 'm3') cm3 = vol * 1000000;

  // Convert from cm3 to container unit volume
  if (containerUnit === 'cm') return cm3;
  if (containerUnit === 'in') return cm3 / 16.387064; // 1 in3 = 16.387064 cm3
  if (containerUnit === 'ft') return cm3 / 28316.846592; // 1 ft3 = 28316.846592 cm3
  return vol;
}

export function calculateBestPacking(
  item1: Dimensions,
  container: Dimensions,
  options?: PackingOptions
): PackingResult {
  const iL1 = item1.length;
  const iW1 = item1.width;
  const iH1 = item1.height;
  const cL = container.length;
  const cW = container.width;
  const cH = container.height;

  if ([iL1, iW1, iH1, cL, cW, cH].some(v => v <= 0)) {
    return {
      count: 0, count1: 0, count2: 0, items: [], efficiency: 0, waste: 0,
      orientation: { length: iL1, width: iW1, height: iH1 },
      layout: [0, 0, 0]
    };
  }

  // Determine error margin
  const errorMarginActive = !!options?.errorMargin;
  const containerUnit = options?.containerUnit || 'cm';
  // Standard margin value (equivalent to ~0.8cm): 0.8 cm, 0.3 in, 0.026 ft
  const margin = errorMarginActive
    ? (containerUnit === 'cm' ? 0.8 : (containerUnit === 'in' ? 0.3 : 0.026))
    : 0;

  // Set limits
  let limit1 = Infinity;
  let limit2 = 0;

  const volUnit = options?.volumeUnit || 'cm3';

  if (options?.maxVolume1 && options.maxVolume1 > 0) {
    const maxVol1Container = convertVolumeToContainerUnit(options.maxVolume1, volUnit, containerUnit);
    const item1Vol = iL1 * iW1 * iH1;
    limit1 = Math.floor(maxVol1Container / item1Vol);
  }

  const hasSecondaryItem = !!options?.item2 && (options.item2.length > 0 && options.item2.width > 0 && options.item2.height > 0);
  const iL2 = options?.item2?.length || 0;
  const iW2 = options?.item2?.width || 0;
  const iH2 = options?.item2?.height || 0;

  if (hasSecondaryItem) {
    if (options?.maxVolume2 && options.maxVolume2 > 0) {
      const maxVol2Container = convertVolumeToContainerUnit(options.maxVolume2, volUnit, containerUnit);
      const item2Vol = iL2 * iW2 * iH2;
      limit2 = Math.floor(maxVol2Container / item2Vol);
    } else {
      limit2 = Infinity; // secondary item is enabled but unlimited
    }
  }

  const orientations1 = [
    [iL1, iW1, iH1], [iL1, iH1, iW1],
    [iW1, iL1, iH1], [iW1, iH1, iL1],
    [iH1, iL1, iW1], [iH1, iW1, iL1]
  ];

  const orientations2 = hasSecondaryItem ? [
    [iL2, iW2, iH2], [iL2, iH2, iW2],
    [iW2, iL2, iH2], [iW2, iH2, iL2],
    [iH2, iL2, iW2], [iH2, iW2, iL2]
  ] : [];

  let absoluteBestItems: PackedItem[] = [];
  let absoluteBestOri1 = orientations1[0];
  let absoluteBestOri2 = orientations2[0] || [0, 0, 0];
  let absoluteBestLayout1: [number, number, number] = [0, 0, 0];
  let absoluteBestLayout2: [number, number, number] = [0, 0, 0];

  const distMode = options?.distributionMode || 'optimal';

  // Evaluate combinations of primary orientations to seed the packing
  for (const primaryOri of orientations1) {
    const spaces: Space[] = [{ l: cL, w: cW, h: cH, x: 0, y: 0, z: 0 }];
    const currentItems: PackedItem[] = [];
    let isFirstSpace = true;
    let baseLayout1: [number, number, number] = [0, 0, 0];
    let baseLayout2: [number, number, number] = [0, 0, 0];
    let packed1Count = 0;
    let packed2Count = 0;

    while (spaces.length > 0) {
      // Sort spaces according to the distribution mode
      if (distMode === 'x-first') {
        spaces.sort((a, b) => {
          if (Math.abs(a.x - b.x) > 0.001) return a.x - b.x;
          if (Math.abs(a.y - b.y) > 0.001) return a.y - b.y;
          return a.z - b.z;
        });
      } else if (distMode === 'y-first') {
        spaces.sort((a, b) => {
          if (Math.abs(a.y - b.y) > 0.001) return a.y - b.y;
          if (Math.abs(a.x - b.x) > 0.001) return a.x - b.x;
          return a.z - b.z;
        });
      } else if (distMode === 'z-first') {
        spaces.sort((a, b) => {
          if (Math.abs(a.z - b.z) > 0.001) return a.z - b.z;
          if (Math.abs(a.x - b.x) > 0.001) return a.x - b.x;
          return a.y - b.y;
        });
      } else {
        // Optimal or Split mode: largest spaces first by volume
        spaces.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h));
      }

      const space = spaces.shift()!;

      let bestSpaceOri: number[] | null = null;
      let maxSpaceVolume = 0;
      let spaceArrangement = [0, 0, 0];
      let selectedItemType: 1 | 2 = 1;

      // In split mode, we only pack Item 1 until we can't anymore, then Item 2
      const tryItem1 = distMode !== 'split' || packed1Count < limit1;
      const tryItem2 = hasSecondaryItem && (distMode !== 'split' || packed1Count >= limit1 || currentItems.length === 0);

      // Test Item 1 orientations
      if (tryItem1 && packed1Count < limit1) {
        const orisToTest = isFirstSpace ? [primaryOri] : orientations1;
        for (const ori of orisToTest) {
          const paddedL = ori[0] + margin;
          const paddedW = ori[1] + margin;
          const paddedH = ori[2] + margin;

          const nx = Math.floor(space.l / paddedL);
          const ny = Math.floor(space.w / paddedW);
          const nz = Math.floor(space.h / paddedH);
          const total = nx * ny * nz;
          const allowed = Math.min(total, limit1 - packed1Count);

          if (allowed > 0) {
            const vol = allowed * (ori[0] * ori[1] * ori[2]);
            if (vol > maxSpaceVolume) {
              maxSpaceVolume = vol;
              bestSpaceOri = ori;
              spaceArrangement = [nx, ny, nz];
              selectedItemType = 1;
            }
          }
        }
      }

      // Test Item 2 orientations
      if (tryItem2 && packed2Count < limit2) {
        for (const ori of orientations2) {
          const paddedL = ori[0] + margin;
          const paddedW = ori[1] + margin;
          const paddedH = ori[2] + margin;

          const nx = Math.floor(space.l / paddedL);
          const ny = Math.floor(space.w / paddedW);
          const nz = Math.floor(space.h / paddedH);
          const total = nx * ny * nz;
          const allowed = Math.min(total, limit2 - packed2Count);

          if (allowed > 0) {
            const vol = allowed * (ori[0] * ori[1] * ori[2]);
            // Prefer Item 2 if it packs more volume or if we specifically can't pack Item 1 anymore
            if (vol > maxSpaceVolume) {
              maxSpaceVolume = vol;
              bestSpaceOri = ori;
              spaceArrangement = [nx, ny, nz];
              selectedItemType = 2;
            }
          }
        }
      }

      if (maxSpaceVolume > 0 && bestSpaceOri) {
        let [nx, ny, nz] = spaceArrangement;
        const [l, w, h] = bestSpaceOri;

        const paddedL = l + margin;
        const paddedW = w + margin;
        const paddedH = h + margin;

        // Cap quantities by remaining limits
        if (selectedItemType === 1) {
          const remaining = limit1 - packed1Count;
          if (nx * ny * nz > remaining) {
            // Find a way to reduce nx, ny, nz to match remaining
            // Greedily reduce from height, then width, then length
            while (nx * ny * nz > remaining && nz > 0) {
              nz--;
            }
            if (nz === 0) nz = 1;
            while (nx * ny * nz > remaining && ny > 0) {
              ny--;
            }
            if (ny === 0) ny = 1;
            while (nx * ny * nz > remaining && nx > 0) {
              nx--;
            }
          }
          packed1Count += nx * ny * nz;
          if (isFirstSpace) {
            baseLayout1 = [nx, ny, nz];
          }
        } else {
          const remaining = limit2 - packed2Count;
          if (nx * ny * nz > remaining) {
            while (nx * ny * nz > remaining && nz > 0) {
              nz--;
            }
            if (nz === 0) nz = 1;
            while (nx * ny * nz > remaining && ny > 0) {
              ny--;
            }
            if (ny === 0) ny = 1;
            while (nx * ny * nz > remaining && nx > 0) {
              nx--;
            }
          }
          packed2Count += nx * ny * nz;
          if (isFirstSpace) {
            baseLayout2 = [nx, ny, nz];
          }
        }

        // Add packed items using ordering based on distribution mode
        // Define loops depending on the first axis we want to stack along
        const addPackedItem = (ix: number, iy: number, iz: number) => {
          currentItems.push({
            x: space.x + ix * paddedL,
            y: space.y + iy * paddedW,
            z: space.z + iz * paddedH,
            dx: paddedL,
            dy: paddedW,
            dz: paddedH,
            originalDx: l,
            originalDy: w,
            originalDz: h,
            type: selectedItemType
          });
        };

        if (distMode === 'z-first') {
          // Fill columns first: loop z inner, then y, then x
          for (let ix = 0; ix < nx; ix++) {
            for (let iy = 0; iy < ny; iy++) {
              for (let iz = 0; iz < nz; iz++) {
                addPackedItem(ix, iy, iz);
              }
            }
          }
        } else if (distMode === 'x-first') {
          // Fill along length first: loop x inner, then y, then z
          for (let iz = 0; iz < nz; iz++) {
            for (let iy = 0; iy < ny; iy++) {
              for (let ix = 0; ix < nx; ix++) {
                addPackedItem(ix, iy, iz);
              }
            }
          }
        } else if (distMode === 'y-first') {
          // Fill along width first: loop y inner, then x, then z
          for (let iz = 0; iz < nz; iz++) {
            for (let ix = 0; ix < nx; ix++) {
              for (let iy = 0; iy < ny; iy++) {
                addPackedItem(ix, iy, iz);
              }
            }
          }
        } else {
          // Default loop
          for (let ix = 0; ix < nx; ix++) {
            for (let iy = 0; iy < ny; iy++) {
              for (let iz = 0; iz < nz; iz++) {
                addPackedItem(ix, iy, iz);
              }
            }
          }
        }

        // Guillotine split into 3 remaining spaces
        const usedL = nx * paddedL;
        const usedW = ny * paddedW;
        const usedH = nz * paddedH;

        // Space 1: Rest of L
        if (space.l - usedL > 0.001) {
          spaces.push({
            l: space.l - usedL, w: space.w, h: space.h,
            x: space.x + usedL, y: space.y, z: space.z
          });
        }
        // Space 2: Rest of W
        if (space.w - usedW > 0.001) {
          spaces.push({
            l: usedL, w: space.w - usedW, h: space.h,
            x: space.x, y: space.y + usedW, z: space.z
          });
        }
        // Space 3: Rest of H
        if (space.h - usedH > 0.001) {
          spaces.push({
            l: usedL, w: usedW, h: space.h - usedH,
            x: space.x, y: space.y, z: space.z + usedH
          });
        }
      }
      isFirstSpace = false;
    }

    // Compare this packing outcome
    if (currentItems.length > absoluteBestItems.length) {
      absoluteBestItems = currentItems;
      absoluteBestOri1 = primaryOri;
      absoluteBestLayout1 = baseLayout1;
      absoluteBestLayout2 = baseLayout2;
      // Find what the best orientation for Item 2 was in this run
      const item2InBest = currentItems.find(i => i.type === 2);
      if (item2InBest) {
        absoluteBestOri2 = [item2InBest.originalDx, item2InBest.originalDy, item2InBest.originalDz];
      }
    }
  }

  const item1Vol = iL1 * iW1 * iH1;
  const item2Vol = iL2 * iW2 * iH2;
  const contVol = cL * cW * cH;

  const count1 = absoluteBestItems.filter(i => i.type === 1).length;
  const count2 = absoluteBestItems.filter(i => i.type === 2).length;

  const totalUsedVol = count1 * item1Vol + count2 * item2Vol;
  const efficiency = (totalUsedVol / contVol) * 100;
  const waste = Math.max(0, contVol - totalUsedVol);

  return {
    count: absoluteBestItems.length,
    count1,
    count2,
    items: absoluteBestItems,
    orientation: {
      length: absoluteBestOri1[0],
      width: absoluteBestOri1[1],
      height: absoluteBestOri1[2]
    },
    orientation2: hasSecondaryItem ? {
      length: absoluteBestOri2[0],
      width: absoluteBestOri2[1],
      height: absoluteBestOri2[2]
    } : undefined,
    layout: absoluteBestLayout1,
    layout2: hasSecondaryItem ? absoluteBestLayout2 : undefined,
    efficiency,
    waste
  };
}

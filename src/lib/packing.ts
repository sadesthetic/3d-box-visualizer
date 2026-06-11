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

export interface PackedPallet {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  type: 1 | 2;         // 1: Loaded with item 1, 2: Loaded with item 2
}

export interface PackingResult {
  count: number;
  count1: number;
  count2: number;
  items: PackedItem[];
  pallets?: PackedPallet[];
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
  maxCount1?: number;  // Max quantity for Item 1
  maxCount2?: number;  // Max quantity for Item 2
  limitMode?: 'volume' | 'quantity';
  volumeUnit?: 'ft3' | 'cm3' | 'm3';
  containerUnit: 'in' | 'cm' | 'ft';
  distributionMode?: 'optimal' | 'split' | 'x-first' | 'y-first' | 'z-first';
  errorMargin?: boolean;
  restrictToHorizontal?: boolean; // Restrict rotation to horizontal plane (Z-axis only)
  palletMode?: boolean;
  palletType?: 'eur' | 'us';
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

  const containerUnit = options?.containerUnit || 'cm';

  // --- PALLET SIMULATION MODE ---
  if (options?.palletMode) {
    const palletWoodHeight = containerUnit === 'cm' ? 15 : (containerUnit === 'in' ? 5.9 : 0.49);
    let pL = containerUnit === 'cm' ? 120 : (containerUnit === 'in' ? 47.2 : 3.94);
    let pW = containerUnit === 'cm' ? 80 : (containerUnit === 'in' ? 31.5 : 2.62);

    if (options.palletType === 'us') {
      pL = containerUnit === 'cm' ? 122 : (containerUnit === 'in' ? 48.0 : 4.00);
      pW = containerUnit === 'cm' ? 102 : (containerUnit === 'in' ? 40.0 : 3.33);
    }

    // 1. Pack Item 1 on a single pallet
    const maxCargoH = Math.max(0.1, cH - palletWoodHeight);
    const singlePalletPacking1 = calculateBestPacking(
      item1,
      { length: pL, width: pW, height: maxCargoH },
      { containerUnit, errorMargin: options.errorMargin }
    );
    const k1 = singlePalletPacking1.count;
    const cargoH1 = k1 > 0 ? Math.max(...singlePalletPacking1.items.map(i => i.z + i.dz)) : 0;
    const totalPalletH1 = cargoH1 + palletWoodHeight;

    // 2. Pack Item 2 on a single pallet (if active)
    let k2 = 0;
    let totalPalletH2 = 0;
    let singlePalletPacking2: PackingResult | null = null;
    const hasSecondaryItem = !!options?.item2 && (options.item2.length > 0 && options.item2.width > 0 && options.item2.height > 0);

    if (hasSecondaryItem) {
      singlePalletPacking2 = calculateBestPacking(
        options.item2!,
        { length: pL, width: pW, height: maxCargoH },
        { containerUnit, errorMargin: options.errorMargin }
      );
      k2 = singlePalletPacking2.count;
      const cargoH2 = k2 > 0 ? Math.max(...singlePalletPacking2.items.map(i => i.z + i.dz)) : 0;
      totalPalletH2 = cargoH2 + palletWoodHeight;
    }

    // Convert item constraints to box limits, then to pallet limits
    let boxesLimit1 = Infinity;
    let boxesLimit2 = hasSecondaryItem ? Infinity : 0;

    const limitMode = options?.limitMode || 'volume';

    if (limitMode === 'quantity') {
      if (options?.maxCount1 && options.maxCount1 > 0) {
        boxesLimit1 = options.maxCount1;
      }
      if (hasSecondaryItem && options?.maxCount2 && options.maxCount2 > 0) {
        boxesLimit2 = options.maxCount2;
      }
    } else {
      const volUnit = options?.volumeUnit || 'cm3';
      if (options?.maxVolume1 && options.maxVolume1 > 0) {
        const maxVol1Container = convertVolumeToContainerUnit(options.maxVolume1, volUnit, containerUnit);
        const item1Vol = iL1 * iW1 * iH1;
        boxesLimit1 = Math.floor(maxVol1Container / item1Vol);
      }
      if (hasSecondaryItem && options?.maxVolume2 && options.maxVolume2 > 0) {
        const maxVol2Container = convertVolumeToContainerUnit(options.maxVolume2, volUnit, containerUnit);
        const item2Vol = options.item2!.length * options.item2!.width * options.item2!.height;
        boxesLimit2 = Math.floor(maxVol2Container / item2Vol);
      }
    }

    const maxPallets1 = k1 > 0 ? Math.ceil(boxesLimit1 / k1) : 0;
    const maxPallets2 = k2 > 0 ? Math.ceil(boxesLimit2 / k2) : 0;

    // Now, pack the virtual loaded pallets into the container
    const pallet1Block: Dimensions = { length: pL, width: pW, height: totalPalletH1 };
    const pallet2Block: Dimensions | undefined = hasSecondaryItem
      ? { length: pL, width: pW, height: totalPalletH2 }
      : undefined;

    const palletPackingResult = calculateBestPacking(
      pallet1Block,
      container,
      {
        item2: pallet2Block,
        limitMode: 'quantity',
        maxCount1: maxPallets1,
        maxCount2: maxPallets2,
        restrictToHorizontal: true,
        containerUnit,
        errorMargin: false, // Pallets are loaded perfectly next to each other
        distributionMode: options.distributionMode
      }
    );

    // Expand packed pallets into boxes and record wood bases
    const expandedBoxes: PackedItem[] = [];
    const recordedPallets: PackedPallet[] = [];

    let boxes1Count = 0;
    let boxes2Count = 0;

    for (const packedPallet of palletPackingResult.items) {
      const isType2 = packedPallet.type === 2;
      const singlePacking = isType2 ? singlePalletPacking2 : singlePalletPacking1;
      if (!singlePacking) continue;

      const isRotated = Math.abs(packedPallet.dx - pW) < 0.001; // Width is along Length
      const palletBoxes: PackedItem[] = [];

      for (const box of singlePacking.items) {
        if (!isType2 && boxes1Count >= boxesLimit1) continue;
        if (isType2 && boxes2Count >= boxesLimit2) continue;

        let finalX = 0;
        let finalY = 0;
        let finalDx = box.dx;
        let finalDy = box.dy;
        let finalOriginalDx = box.originalDx;
        let finalOriginalDy = box.originalDy;

        if (!isRotated) {
          finalX = packedPallet.x + box.x;
          finalY = packedPallet.y + box.y;
        } else {
          // 90 degree rotation
          finalX = packedPallet.x + (pW - box.y - box.dy);
          finalY = packedPallet.y + box.x;
          finalDx = box.dy;
          finalDy = box.dx;
          finalOriginalDx = box.originalDy;
          finalOriginalDy = box.originalDx;
        }

        palletBoxes.push({
          x: finalX,
          y: finalY,
          z: packedPallet.z + box.z + palletWoodHeight,
          dx: finalDx,
          dy: finalDy,
          dz: box.dz,
          originalDx: finalOriginalDx,
          originalDy: finalOriginalDy,
          originalDz: box.originalDz,
          type: isType2 ? 2 : 1
        });

        if (isType2) {
          boxes2Count++;
        } else {
          boxes1Count++;
        }
      }

      // Only record the pallet and its boxes if it actually contains boxes
      if (palletBoxes.length > 0) {
        expandedBoxes.push(...palletBoxes);
        recordedPallets.push({
          x: packedPallet.x,
          y: packedPallet.y,
          z: packedPallet.z,
          dx: packedPallet.dx,
          dy: packedPallet.dy,
          dz: palletWoodHeight,
          type: packedPallet.type
        });
      }
    }

    const item1Vol = iL1 * iW1 * iH1;
    const item2Vol = hasSecondaryItem ? (options.item2!.length * options.item2!.width * options.item2!.height) : 0;
    const contVol = cL * cW * cH;
    const totalUsedVol = boxes1Count * item1Vol + boxes2Count * item2Vol;
    const efficiency = (totalUsedVol / contVol) * 100;
    const waste = Math.max(0, contVol - totalUsedVol);

    return {
      count: expandedBoxes.length,
      count1: boxes1Count,
      count2: boxes2Count,
      items: expandedBoxes,
      pallets: recordedPallets,
      efficiency,
      waste,
      orientation: {
        length: singlePalletPacking1.orientation.length,
        width: singlePalletPacking1.orientation.width,
        height: singlePalletPacking1.orientation.height
      },
      orientation2: singlePalletPacking2 ? {
        length: singlePalletPacking2.orientation.length,
        width: singlePalletPacking2.orientation.width,
        height: singlePalletPacking2.orientation.height
      } : undefined,
      layout: palletPackingResult.layout,
      layout2: hasSecondaryItem ? palletPackingResult.layout2 : undefined
    };
  }

  // Determine error margin
  const errorMarginActive = !!options?.errorMargin;
  // Standard margin value (equivalent to ~0.8cm): 0.8 cm, 0.3 in, 0.026 ft
  const margin = errorMarginActive
    ? (containerUnit === 'cm' ? 0.8 : (containerUnit === 'in' ? 0.3 : 0.026))
    : 0;

  // Set limits
  let limit1 = Infinity;
  let limit2 = 0;

  const limitMode = options?.limitMode || 'volume';

  if (limitMode === 'quantity') {
    if (options?.maxCount1 && options.maxCount1 > 0) {
      limit1 = options.maxCount1;
    }
  } else {
    const volUnit = options?.volumeUnit || 'cm3';
    if (options?.maxVolume1 && options.maxVolume1 > 0) {
      const maxVol1Container = convertVolumeToContainerUnit(options.maxVolume1, volUnit, containerUnit);
      const item1Vol = iL1 * iW1 * iH1;
      limit1 = Math.floor(maxVol1Container / item1Vol);
    }
  }

  const hasSecondaryItem = !!options?.item2 && (options.item2.length > 0 && options.item2.width > 0 && options.item2.height > 0);
  const iL2 = options?.item2?.length || 0;
  const iW2 = options?.item2?.width || 0;
  const iH2 = options?.item2?.height || 0;

  if (hasSecondaryItem) {
    if (limitMode === 'quantity') {
      if (options?.maxCount2 && options.maxCount2 > 0) {
        limit2 = options.maxCount2;
      } else {
        limit2 = Infinity;
      }
    } else {
      const volUnit = options?.volumeUnit || 'cm3';
      if (options?.maxVolume2 && options.maxVolume2 > 0) {
        const maxVol2Container = convertVolumeToContainerUnit(options.maxVolume2, volUnit, containerUnit);
        const item2Vol = iL2 * iW2 * iH2;
        limit2 = Math.floor(maxVol2Container / item2Vol);
      } else {
        limit2 = Infinity; // secondary item is enabled but unlimited
      }
    }
  }

  const orientations1 = options?.restrictToHorizontal
    ? [[iL1, iW1, iH1], [iW1, iL1, iH1]]
    : [
        [iL1, iW1, iH1], [iL1, iH1, iW1],
        [iW1, iL1, iH1], [iW1, iH1, iL1],
        [iH1, iL1, iW1], [iH1, iW1, iL1]
      ];

  const orientations2 = hasSecondaryItem
    ? (options?.restrictToHorizontal
      ? [[iL2, iW2, iH2], [iW2, iL2, iH2]]
      : [
          [iL2, iW2, iH2], [iL2, iH2, iW2],
          [iW2, iL2, iH2], [iW2, iH2, iL2],
          [iH2, iL2, iW2], [iH2, iW2, iL2]
        ])
    : [];

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
          for (let ix = 0; ix < nx; ix++) {
            for (let iy = 0; iy < ny; iy++) {
              for (let iz = 0; iz < nz; iz++) {
                addPackedItem(ix, iy, iz);
              }
            }
          }
        } else if (distMode === 'x-first') {
          for (let iz = 0; iz < nz; iz++) {
            for (let iy = 0; iy < ny; iy++) {
              for (let ix = 0; ix < nx; ix++) {
                addPackedItem(ix, iy, iz);
              }
            }
          }
        } else if (distMode === 'y-first') {
          for (let iz = 0; iz < nz; iz++) {
            for (let ix = 0; ix < nx; ix++) {
              for (let iy = 0; iy < ny; iy++) {
                addPackedItem(ix, iy, iz);
              }
            }
          }
        } else {
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

        if (space.l - usedL > 0.001) {
          spaces.push({
            l: space.l - usedL, w: space.w, h: space.h,
            x: space.x + usedL, y: space.y, z: space.z
          });
        }
        if (space.w - usedW > 0.001) {
          spaces.push({
            l: usedL, w: space.w - usedW, h: space.h,
            x: space.x, y: space.y + usedW, z: space.z
          });
        }
        if (space.h - usedH > 0.001) {
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
      absoluteBestOri1 = primaryOri;
      absoluteBestLayout1 = baseLayout1;
      absoluteBestLayout2 = baseLayout2;
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
    efficiency,
    waste,
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
    layout2: hasSecondaryItem ? absoluteBestLayout2 : undefined
  };
}

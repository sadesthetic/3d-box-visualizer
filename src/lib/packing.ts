export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface PackingResult {
  count: number;
  orientation: Dimensions;
  layout: [number, number, number];
  efficiency: number;
  waste: number;
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
      count: 0,
      orientation: { length: iL, width: iW, height: iH },
      layout: [0, 0, 0],
      efficiency: 0,
      waste: 0
    };
  }

  const orientations = [
    [iL, iW, iH], [iL, iH, iW],
    [iW, iL, iH], [iW, iH, iL],
    [iH, iL, iW], [iH, iW, iL]
  ];

  let bestFit = { count: -1, dims: [0,0,0], layout: [0,0,0] as [number, number, number] };

  orientations.forEach(ori => {
    const nx = Math.floor(cL / ori[0]);
    const ny = Math.floor(cW / ori[1]);
    const nz = Math.floor(cH / ori[2]);
    const total = nx * ny * nz;

    if (total > bestFit.count) {
      bestFit = { count: total, dims: ori, layout: [nx, ny, nz] };
    }
  });

  const itemVol = iL * iW * iH;
  const contVol = cL * cW * cH;
  const totalUsedVol = bestFit.count * itemVol;
  const efficiency = (totalUsedVol / contVol) * 100;
  const waste = contVol - totalUsedVol;

  return {
    count: bestFit.count,
    orientation: {
      length: bestFit.dims[0],
      width: bestFit.dims[1],
      height: bestFit.dims[2]
    },
    layout: bestFit.layout,
    efficiency,
    waste
  };
}

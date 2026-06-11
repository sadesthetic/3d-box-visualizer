import { useState, useMemo } from 'react';
import { Visualizer } from './components/Visualizer';
import { Calculator } from './components/Calculator';
import type { Dimensions } from './lib/packing';
import { calculateBestPacking } from './lib/packing';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Button } from './components/ui/button';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Separator } from './components/ui/separator';
import { Badge } from './components/ui/badge';
import { Box, Container, Info, Maximize2, RotateCcw, Lightbulb, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [itemUnit, setItemUnit] = useState<'in' | 'cm' | 'ft'>('cm');
  const [containerUnit, setContainerUnit] = useState<'in' | 'cm' | 'ft'>('in');

  const [item, setItem] = useState({ length: '10', width: '6', height: '4' });
  const [container, setContainer] = useState({ length: '20', width: '20', height: '20' });

  // Advanced configurations
  const [errorMargin, setErrorMargin] = useState(false);
  const [multiItemMode, setMultiItemMode] = useState(false);
  const [volumeUnit, setVolumeUnit] = useState<'ft3' | 'cm3' | 'm3'>('ft3');
  const [maxVolume1, setMaxVolume1] = useState('');
  const [maxVolume2, setMaxVolume2] = useState('');
  const [item2, setItem2] = useState({ length: '8', width: '5', height: '3' });
  const [distributionMode, setDistributionMode] = useState<'optimal' | 'split' | 'x-first' | 'y-first' | 'z-first'>('optimal');

  const [showResult, setShowResult] = useState(false);
  const [highlightContainer, setHighlightContainer] = useState(false);
  const [activeTab, setActiveTab] = useState('visualizer');
  const [forceSquareContainer, setForceSquareContainer] = useState(false);

  const convertUnit = (val: number, from: 'cm' | 'in' | 'ft', to: 'cm' | 'in' | 'ft'): number => {
    if (from === to) return val;
    let cm = val;
    if (from === 'in') cm = val * 2.54;
    else if (from === 'ft') cm = val * 30.48;

    if (to === 'cm') return cm;
    if (to === 'in') return cm / 2.54;
    if (to === 'ft') return cm / 30.48;
    return val;
  };

  const handleContainerUnitChange = (newUnit: 'cm' | 'in' | 'ft') => {
    setContainer(prev => ({
      length: convertUnit(parseFloat(prev.length) || 0, containerUnit, newUnit).toFixed(newUnit === 'ft' ? 2 : 1),
      width: convertUnit(parseFloat(prev.width) || 0, containerUnit, newUnit).toFixed(newUnit === 'ft' ? 2 : 1),
      height: convertUnit(parseFloat(prev.height) || 0, containerUnit, newUnit).toFixed(newUnit === 'ft' ? 2 : 1),
    }));
    setContainerUnit(newUnit);
    setShowResult(false);
  };

  const handleItemUnitChange = (newUnit: 'cm' | 'in' | 'ft') => {
    setItem(prev => ({
      length: convertUnit(parseFloat(prev.length) || 0, itemUnit, newUnit).toFixed(newUnit === 'ft' ? 2 : 1),
      width: convertUnit(parseFloat(prev.width) || 0, itemUnit, newUnit).toFixed(newUnit === 'ft' ? 2 : 1),
      height: convertUnit(parseFloat(prev.height) || 0, itemUnit, newUnit).toFixed(newUnit === 'ft' ? 2 : 1),
    }));
    setItemUnit(newUnit);
    setShowResult(false);
  };

  const handleApplyPreset = (size: 20 | 40) => {
    const presetCm = size === 20 
      ? { length: 590, width: 235, height: 239 }
      : { length: 1203, width: 235, height: 239 };

    const converted = {
      length: convertUnit(presetCm.length, 'cm', containerUnit).toFixed(containerUnit === 'ft' ? 2 : 1),
      width: convertUnit(presetCm.width, 'cm', containerUnit).toFixed(containerUnit === 'ft' ? 2 : 1),
      height: convertUnit(presetCm.height, 'cm', containerUnit).toFixed(containerUnit === 'ft' ? 2 : 1)
    };

    setContainer(converted);
    setShowResult(false);
  };

  const result = useMemo(() => {
    const parsedItem = {
      length: parseFloat(item.length) || 0,
      width: parseFloat(item.width) || 0,
      height: parseFloat(item.height) || 0,
    };
    const parsedContainer = {
      length: parseFloat(container.length) || 0,
      width: parseFloat(container.width) || 0,
      height: parseFloat(container.height) || 0,
    };

    const convertedItem = {
      length: convertUnit(parsedItem.length, itemUnit, containerUnit),
      width: convertUnit(parsedItem.width, itemUnit, containerUnit),
      height: convertUnit(parsedItem.height, itemUnit, containerUnit),
    };

    let convertedItem2 = undefined;
    if (multiItemMode) {
      const parsedItem2 = {
        length: parseFloat(item2.length) || 0,
        width: parseFloat(item2.width) || 0,
        height: parseFloat(item2.height) || 0,
      };
      convertedItem2 = {
        length: convertUnit(parsedItem2.length, itemUnit, containerUnit),
        width: convertUnit(parsedItem2.width, itemUnit, containerUnit),
        height: convertUnit(parsedItem2.height, itemUnit, containerUnit),
      };
    }

    return calculateBestPacking(convertedItem, parsedContainer, {
      item2: convertedItem2,
      maxVolume1: multiItemMode ? (parseFloat(maxVolume1) || 0) : 0,
      maxVolume2: multiItemMode ? (parseFloat(maxVolume2) || 0) : 0,
      volumeUnit: volumeUnit,
      containerUnit: containerUnit,
      distributionMode: distributionMode,
      errorMargin: errorMargin,
    });
  }, [item, container, item2, itemUnit, containerUnit, errorMargin, multiItemMode, volumeUnit, maxVolume1, maxVolume2, distributionMode]);

  const itemVolFt3 = useMemo(() => {
    const l = parseFloat(item.length) || 0;
    const w = parseFloat(item.width) || 0;
    const h = parseFloat(item.height) || 0;
    const vol = l * w * h;
    if (itemUnit === 'ft') return vol;
    return itemUnit === 'in' ? vol / 1728 : vol / 28316.846592;
  }, [item, itemUnit]);

  const item2VolFt3 = useMemo(() => {
    const l = parseFloat(item2.length) || 0;
    const w = parseFloat(item2.width) || 0;
    const h = parseFloat(item2.height) || 0;
    const vol = l * w * h;
    if (itemUnit === 'ft') return vol;
    return itemUnit === 'in' ? vol / 1728 : vol / 28316.846592;
  }, [item2, itemUnit]);

  const handleItemChange = (key: keyof Dimensions, value: string) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setItem((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleItem2Change = (key: keyof Dimensions, value: string) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setItem2((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleContainerChange = (key: keyof Dimensions, value: string) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setContainer((prev) => {
        if (forceSquareContainer && key === 'length') {
          return { length: value, width: value, height: value };
        }
        return { ...prev, [key]: value };
      });
    }
  };

  const handleNumericInput = (value: string, setter: (val: string) => void) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setter(value);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-50 font-sans overflow-hidden">
      {/* App Navigation */}
      <div className="shrink-0 p-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl z-50 flex justify-center shadow-xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-sm">
          <TabsList className="grid w-full grid-cols-2 bg-slate-950 border border-slate-800">
            <TabsTrigger value="visualizer" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-[10px] font-bold tracking-widest">3D OPTIMIZER</TabsTrigger>
            <TabsTrigger value="calculator" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 text-[10px] font-bold tracking-widest">CALCULATOR</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'visualizer' ? (
        <div className="flex-1 flex flex-col-reverse md:flex-row overflow-hidden relative">
          {/* Sidebar - Acts as a bottom sheet on mobile */}
          <aside className="w-full md:h-full md:w-96 border-t md:border-t-0 md:border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col z-10 shadow-2xl shrink-0 md:shrink overflow-hidden">
            <div className="p-6 border-b border-slate-800 shrink-0 sticky top-0 bg-slate-900/90 backdrop-blur-xl z-10">
              <div className="flex items-center gap-2 mb-1">
                <Box className="w-6 h-6 text-sky-400" />
                <h1 className="text-xl font-bold tracking-tight uppercase italic">Packing Optimizer</h1>
              </div>
              <p className="text-xs text-slate-400 font-mono">v1.0.4 // 6-DOF KINETIC ENGINE</p>
            </div>

            <div className="flex-1 space-y-6 p-6 overflow-y-auto">
              {/* Unit Toggle */}
              <section className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Item Unit</Label>
                  <Tabs value={itemUnit} onValueChange={(v) => handleItemUnitChange(v as 'in' | 'cm' | 'ft')} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-950 border border-slate-800">
                      <TabsTrigger value="in" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-[10px] font-bold">IN</TabsTrigger>
                      <TabsTrigger value="cm" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-[10px] font-bold">CM</TabsTrigger>
                      <TabsTrigger value="ft" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-[10px] font-bold">FT</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Container Unit</Label>
                  <div className="flex flex-col gap-1.5">
                    {/* Story 1: Unit Selector */}
                    <Tabs value={containerUnit} onValueChange={(v) => handleContainerUnitChange(v as 'in' | 'cm' | 'ft')} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 bg-slate-950 border border-slate-800">
                        <TabsTrigger value="in" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-[10px] font-bold">IN</TabsTrigger>
                        <TabsTrigger value="cm" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-[10px] font-bold">CM</TabsTrigger>
                        <TabsTrigger value="ft" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-[10px] font-bold">FT</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {/* Story 2: Shortcuts */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyPreset(20)}
                        type="button"
                        className="h-7 text-[9px] font-mono border-slate-800 bg-slate-950/40 text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
                        title="Medidas internas de contenedor de 20 pies"
                      >
                        20' PRESET
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyPreset(40)}
                        type="button"
                        className="h-7 text-[9px] font-mono border-slate-800 bg-slate-950/40 text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
                        title="Medidas internas de contenedor de 40 pies"
                      >
                        40' PRESET
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              <Separator className="bg-slate-800" />

              {/* Item Dimensions */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Item Dimensions (Small)</Label>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] border-sky-500/30 text-sky-400 h-5 px-1.5 flex items-center justify-center">PRIMARY</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="iL" className="text-[10px] text-slate-400">LENGTH</Label>
                    <Input
                      id="iL"
                      type="number"
                      value={item.length}
                      onChange={(e) => handleItemChange('length', e.target.value)}
                      className="bg-slate-950 border-slate-800 focus:border-sky-500 h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="iW" className="text-[10px] text-slate-400">WIDTH</Label>
                    <Input
                      id="iW"
                      type="number"
                      value={item.width}
                      onChange={(e) => handleItemChange('width', e.target.value)}
                      className="bg-slate-950 border-slate-800 focus:border-sky-500 h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="iH" className="text-[10px] text-slate-400">HEIGHT</Label>
                    <Input
                      id="iH"
                      type="number"
                      value={item.height}
                      onChange={(e) => handleItemChange('height', e.target.value)}
                      className="bg-slate-950 border-slate-800 focus:border-sky-500 h-9 text-sm font-mono"
                    />
                  </div>
                </div>
              </section>



              {/* Container Dimensions */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Container Dimensions</Label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setForceSquareContainer(!forceSquareContainer);
                        if (!forceSquareContainer) {
                          setContainer(prev => ({ ...prev, width: prev.length, height: prev.length }));
                          setShowResult(false);
                        }
                      }}
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-colors focus:outline-none ${forceSquareContainer
                          ? 'border-sky-500/50 text-sky-400 bg-sky-500/10'
                          : 'border-slate-800 text-slate-500 hover:text-slate-400 bg-transparent'
                        }`}
                      title="Make container a perfect cube (length = width = height)"
                    >
                      CUBE
                    </button>
                    <button
                      onClick={() => setHighlightContainer(!highlightContainer)}
                      className={`inline-flex items-center justify-center rounded-full border w-6 h-6 transition-colors focus:outline-none ${highlightContainer
                          ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                          : 'border-slate-800 text-slate-500 hover:text-slate-400 bg-transparent'
                        }`}
                      title="Highlight container"
                    >
                      <Lightbulb className="w-3 h-3" />
                    </button>
                    <Badge variant="outline" className="text-[9px] border-sky-500/30 text-sky-400">INPUT_B</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cL" className="text-[10px] text-slate-400">{forceSquareContainer ? 'SIZE (L, W, H)' : 'LENGTH'}</Label>
                    <Input
                      id="cL"
                      type="number"
                      value={container.length}
                      onChange={(e) => handleContainerChange('length', e.target.value)}
                      className="bg-slate-950 border-slate-800 focus:border-sky-500 h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cW" className="text-[10px] text-slate-400">WIDTH</Label>
                    <Input
                      id="cW"
                      type="number"
                      value={container.width}
                      onChange={(e) => handleContainerChange('width', e.target.value)}
                      disabled={forceSquareContainer}
                      className={`bg-slate-950 border-slate-800 h-9 text-sm font-mono ${forceSquareContainer ? 'opacity-40 cursor-not-allowed' : 'focus:border-sky-500'}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cH" className="text-[10px] text-slate-400">HEIGHT</Label>
                    <Input
                      id="cH"
                      type="number"
                      value={container.height}
                      onChange={(e) => handleContainerChange('height', e.target.value)}
                      disabled={forceSquareContainer}
                      className={`bg-slate-950 border-slate-800 h-9 text-sm font-mono ${forceSquareContainer ? 'opacity-40 cursor-not-allowed' : 'focus:border-sky-500'}`}
                    />
                  </div>
                </div>
              </section>

              <Separator className="bg-slate-800" />

              {/* Margen de Error Humano Toggle */}
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${errorMargin ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`} />
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">Margen de Error Realista</span>
                    <span className="text-[8px] text-slate-500 font-mono">Tolerancia humana (+0.8cm)</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setErrorMargin(!errorMargin)}
                  type="button"
                  className={`h-7 px-3 text-[9px] font-mono transition-all duration-300 ${
                    errorMargin
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {errorMargin ? 'ON' : 'OFF'}
                </Button>
              </div>

              <Separator className="bg-slate-800" />

              {/* Modo de Espacio Útil Limitado & Multi-Item */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col text-left">
                    <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Configuración Avanzada</Label>
                    <span className="text-[9px] text-slate-600 font-mono">Espacio útil & Multi-Ítem</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMultiItemMode(!multiItemMode);
                      setShowResult(false);
                    }}
                    type="button"
                    className={`h-7 px-2.5 text-[9px] font-bold uppercase transition-all duration-300 ${
                      multiItemMode
                        ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                        : 'border-slate-800 text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    {multiItemMode ? 'Activo' : 'Desactivado'}
                  </Button>
                </div>

                <AnimatePresence initial={false}>
                  {multiItemMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden space-y-4 pt-1"
                    >
                      {/* Selector de Unidad de Volumen */}
                      <div className="space-y-2 text-left">
                        <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Unidad de Volumen Limitador</Label>
                        <Tabs value={volumeUnit} onValueChange={(v) => setVolumeUnit(v as 'ft3' | 'cm3' | 'm3')} className="w-full">
                          <TabsList className="grid w-full grid-cols-3 bg-slate-950 border border-slate-800 h-8">
                            <TabsTrigger value="ft3" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 text-[9px] font-bold">FT³</TabsTrigger>
                            <TabsTrigger value="cm3" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 text-[9px] font-bold">CM³</TabsTrigger>
                            <TabsTrigger value="m3" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 text-[9px] font-bold">M³</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      {/* Límite Item 1 */}
                      <div className="space-y-1.5 text-left">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="maxVol1" className="text-[10px] text-slate-400">Límite Volumen Ítem 1 ({volumeUnit})</Label>
                          <span className="text-[8px] text-slate-600 font-mono">0 = Sin Límite</span>
                        </div>
                        <Input
                          id="maxVol1"
                          type="number"
                          placeholder="Sin límite"
                          value={maxVolume1}
                          onChange={(e) => handleNumericInput(e.target.value, setMaxVolume1)}
                          className="bg-slate-950 border-slate-800 focus:border-sky-500 h-9 text-sm font-mono"
                        />
                      </div>

                      <Separator className="bg-slate-800/60" />

                      {/* Item 2 Dimensions */}
                      <div className="space-y-3 text-left">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Dimensiones Ítem 2 (Secundario)</Label>
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 h-5 px-1.5 flex items-center justify-center">SECONDARY</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="iL2" className="text-[9px] text-slate-400">LENGTH</Label>
                            <Input
                              id="iL2"
                              type="number"
                              value={item2.length}
                              onChange={(e) => handleItem2Change('length', e.target.value)}
                              className="bg-slate-950 border-slate-800 focus:border-emerald-500 h-9 text-sm font-mono text-emerald-400"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="iW2" className="text-[9px] text-slate-400">WIDTH</Label>
                            <Input
                              id="iW2"
                              type="number"
                              value={item2.width}
                              onChange={(e) => handleItem2Change('width', e.target.value)}
                              className="bg-slate-950 border-slate-800 focus:border-emerald-500 h-9 text-sm font-mono text-emerald-400"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="iH2" className="text-[9px] text-slate-400">HEIGHT</Label>
                            <Input
                              id="iH2"
                              type="number"
                              value={item2.height}
                              onChange={(e) => handleItem2Change('height', e.target.value)}
                              className="bg-slate-950 border-slate-800 focus:border-emerald-500 h-9 text-sm font-mono text-emerald-400"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Límite Item 2 */}
                      <div className="space-y-1.5 text-left">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="maxVol2" className="text-[10px] text-slate-400">Límite Volumen Ítem 2 ({volumeUnit})</Label>
                          <span className="text-[8px] text-slate-600 font-mono">0 = Sin Límite</span>
                        </div>
                        <Input
                          id="maxVol2"
                          type="number"
                          placeholder="Sin límite"
                          value={maxVolume2}
                          onChange={(e) => handleNumericInput(e.target.value, setMaxVolume2)}
                          className="bg-slate-950 border-slate-800 focus:border-emerald-500 h-9 text-sm font-mono"
                        />
                      </div>

                      <Separator className="bg-slate-800/60" />

                      {/* Selector de Modo de Distribución */}
                      <div className="space-y-2 text-left">
                        <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Patrón de Distribución de Cajas</Label>
                        <div className="grid grid-cols-5 gap-1">
                          {[
                            { id: 'optimal', label: 'Opti' },
                            { id: 'split', label: 'Split' },
                            { id: 'x-first', label: 'Largo' },
                            { id: 'y-first', label: 'Ancho' },
                            { id: 'z-first', label: 'Fondo' }
                          ].map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => setDistributionMode(mode.id as any)}
                              className={`h-7 text-[8px] uppercase font-bold rounded border transition-colors ${
                                distributionMode === mode.id
                                  ? 'bg-sky-500 border-sky-400 text-slate-950'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                              }`}
                              title={
                                mode.id === 'optimal' ? 'Optimización greedy mixta' :
                                mode.id === 'split' ? 'Empacar todo el Item 1, luego el Item 2' :
                                mode.id === 'x-first' ? 'Ordenar a lo largo (Eje X)' :
                                mode.id === 'y-first' ? 'Ordenar a lo ancho (Eje Y)' :
                                'Ordenar hacia el fondo / vertical (Eje Z)'
                              }
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <Button
                  onClick={() => setShowResult(true)}
                  className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold uppercase tracking-tighter"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Calculate Packing
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowResult(false);
                    setItem({ length: '10', width: '6', height: '4' });
                    setItem2({ length: '8', width: '5', height: '3' });
                    setContainer({ length: '20', width: '20', height: '20' });
                    setErrorMargin(false);
                    setMultiItemMode(false);
                    setMaxVolume1('');
                    setMaxVolume2('');
                    setDistributionMode('optimal');
                  }}
                  type="button"
                  className="w-full border-slate-800 hover:bg-slate-800 text-slate-400 text-xs uppercase"
                >
                  <RotateCcw className="w-3 h-3 mr-2" />
                  Reset Parameters
                </Button>
              </div>

              {/* Metrics moved to 3D overlay */}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/50">
              <p className="text-[10px] text-slate-600 font-mono text-center">
                © 2024 PACKING_SYSTEMS_INTL // ALL_RIGHTS_RESERVED
              </p>
            </div>
          </aside>

          {/* Main Viewport + Mobile Metrics Container */}
          <div className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden relative bg-slate-950">
            <main className="w-full h-[60vw] md:h-full relative shrink-0 overflow-hidden border-b md:border-b-0 border-slate-800">
              <motion.div className="w-full h-full">
                <Visualizer
                  item={{ length: parseFloat(item.length) || 0, width: parseFloat(item.width) || 0, height: parseFloat(item.height) || 0 }}
                  container={{ length: parseFloat(container.length) || 0, width: parseFloat(container.width) || 0, height: parseFloat(container.height) || 0 }}
                  secondaryItem={multiItemMode ? { length: parseFloat(item2.length) || 0, width: parseFloat(item2.width) || 0, height: parseFloat(item2.height) || 0 } : undefined}
                  result={showResult ? result : { count: 0, count1: 0, count2: 0, items: [], orientation: { length: parseFloat(item.length) || 0, width: parseFloat(item.width) || 0, height: parseFloat(item.height) || 0 }, layout: [0, 0, 0], efficiency: 0, waste: 0 }}
                  unit={containerUnit}
                  itemUnit={itemUnit}
                  highlightContainer={highlightContainer}
                />
              </motion.div>

              {/* Desktop Efficiency Metrics - Bottom of viewport, two rows, hidden on mobile */}
              <div className="hidden md:block absolute bottom-6 left-0 right-0 pointer-events-none z-20 px-6">
                <AnimatePresence>
                  {showResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ type: "spring", damping: 20, stiffness: 100 }}
                      className="flex flex-col gap-2 items-start pointer-events-auto"
                    >
                      {/* Row 1: label + waste */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-lg px-3 py-1.5 shadow-xl">
                          <div className={`w-1.5 h-1.5 rounded-full ${result.efficiency > 80 ? 'bg-emerald-500' : result.efficiency > 50 ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`} />
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Efficiency Metrics</span>
                        </div>
                        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-3 shadow-xl">
                          <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Waste</span>
                          <span className="text-[11px] font-mono text-rose-400">{result.waste.toFixed(1)} {containerUnit}³</span>
                        </div>
                      </div>

                      {/* Row 2: efficiency bar + packed + layout + tip */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-lg px-3 py-2 w-52 space-y-1.5 shadow-xl">
                          <div className="flex justify-between text-[9px] font-bold uppercase">
                            <span className="text-slate-500">Vol. Efficiency</span>
                            <span className="text-sky-400">{result.efficiency.toFixed(1)}%</span>
                          </div>
                          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${result.efficiency}%` }}
                              className={`h-full ${result.efficiency > 80 ? 'bg-emerald-500' : result.efficiency > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            />
                          </div>
                        </div>

                        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-lg px-4 py-2 flex items-center gap-4 shadow-xl">
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Packed</p>
                            <p className="text-xl font-black text-sky-400 font-mono tracking-tighter leading-none">{result.count}</p>
                            {multiItemMode && (
                              <p className="text-[8px] font-mono text-slate-400 mt-1 whitespace-nowrap">
                                <span className="text-sky-400">i1: {result.count1}</span> | <span className="text-emerald-400">i2: {result.count2}</span>
                              </p>
                            )}
                          </div>
                          <div className="w-px h-7 bg-slate-700" />
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Layout</p>
                            <p className="text-xs font-mono text-slate-300 leading-none">{result.layout[0]}×{result.layout[1]}×{result.layout[2]}</p>
                            {multiItemMode && result.layout2 && (
                              <p className="text-[8px] font-mono text-slate-400 mt-1">
                                <span className="text-emerald-400">i2: {result.layout2[0]}×{result.layout2[1]}×{result.layout2[2]}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {result.count > 0 && (
                          <div className="bg-slate-900/80 backdrop-blur-xl border border-sky-500/20 rounded-lg px-3 py-2 flex items-start gap-2 max-w-[260px] shadow-lg">
                            <Info className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-sky-200/70 leading-relaxed italic">
                              {parseFloat(container.length) % result.orientation.length > 0
                                ? `−${(parseFloat(container.length) % result.orientation.length).toFixed(1)}${containerUnit} → less waste`
                                : 'Optimal configuration.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Top Status Bar - Desktop only, top-left corner */}
              <div className="hidden md:flex absolute top-4 left-4 pointer-events-none z-20">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 px-4 py-2 rounded-full shadow-xl pointer-events-auto flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Maximize2 className="w-3 h-3 text-sky-400" />
                    <span className="text-[10px] font-mono text-slate-300 uppercase tracking-tighter">RENDER_60FPS</span>
                  </div>
                  <Separator orientation="vertical" className="h-3 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <Container className="w-3 h-3 text-sky-400" />
                    <span className="text-[10px] font-mono text-slate-300 uppercase tracking-tighter">THREE_JS_R128</span>
                  </div>
                  <Separator orientation="vertical" className="h-3 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <Box className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-tighter">
                      Vol: i1={itemVolFt3.toFixed(2)} {multiItemMode ? `| i2=${item2VolFt3.toFixed(2)}` : ''} FT³
                    </span>
                  </div>
                </div>
              </div>
            </main>

            {/* Mobile Metrics & Status Section */}
            <section className="md:hidden w-full flex flex-col bg-slate-950 p-4 space-y-4 pb-12">
              <AnimatePresence>
                {showResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${result.efficiency > 80 ? 'bg-emerald-500' : result.efficiency > 50 ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`} />
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Optimization Report</h2>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-sky-500/20 text-sky-400 font-mono">LIVE_DATA</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-left">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Packed Units</p>
                        <p className="text-3xl font-black text-sky-400 font-mono leading-none">{result.count}</p>
                        {multiItemMode && (
                          <p className="text-[9px] font-mono text-slate-400 mt-1.5">
                            i1: {result.count1} // i2: {result.count2}
                          </p>
                        )}
                      </div>
                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-left">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Arrangement</p>
                        <p className="text-lg font-mono text-slate-300 leading-none">{result.layout[0]}×{result.layout[1]}×{result.layout[2]}</p>
                        {multiItemMode && result.layout2 && (
                          <p className="text-[9px] font-mono text-slate-400 mt-1.5">
                            i2: {result.layout2[0]}×{result.layout2[1]}×{result.layout2[2]}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-slate-500">Volume Efficiency</span>
                        <span className="text-sky-400">{result.efficiency.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${result.efficiency > 80 ? 'bg-emerald-500' : result.efficiency > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${result.efficiency}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[9px] text-slate-500 uppercase font-bold">Wasted Area</span>
                        <span className="text-xs font-mono text-rose-400">{result.waste.toFixed(1)} {containerUnit}³</span>
                      </div>
                    </div>

                    {result.count > 0 && (
                      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 flex gap-3 items-start text-left">
                        <Info className="w-4 h-4 text-sky-400 shrink-0" />
                        <p className="text-[11px] text-sky-200/80 leading-relaxed italic">
                          {parseFloat(container.length) % result.orientation.length > 0
                            ? `Optimization Tip: Adjusting the container length by −${(parseFloat(container.length) % result.orientation.length).toFixed(1)}${containerUnit} would significantly minimize unused volume.`
                            : 'This is the most efficient configuration for the selected parameters.'}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="py-8 text-center text-slate-700 border border-dashed border-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-[0.3em] font-mono">Status: Awaiting Metrics</p>
                  </div>
                )}
              </AnimatePresence>

              <div className="pt-4 border-t border-slate-900 flex justify-between items-center opacity-40">
                <div className="flex items-center gap-2">
                  <Container size={12} className="text-slate-500" />
                  <span className="text-[9px] font-mono uppercase">System: Kinetic_v1.0.4</span>
                </div>
                <span className="text-[9px] font-mono uppercase">Item Vol: {itemVolFt3.toFixed(2)} FT³</span>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-slate-950">
          <Calculator />
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Ruler, DollarSign, Info } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Card, CardContent } from './ui/card';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';

import { SplitSquareHorizontal, X } from 'lucide-react';

export function Calculator() {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className={`flex w-full h-full items-start justify-center p-4 gap-4 overflow-y-auto ${showComparison ? 'flex-col md:flex-row md:items-center' : 'items-center'}`}>
       <CalculatorCard isPrimary onCompareToggle={() => setShowComparison(!showComparison)} isComparing={showComparison} />
       {showComparison && <CalculatorCard onRemove={() => setShowComparison(false)} />}
    </div>
  );
}

function CalculatorCard({ isPrimary, onCompareToggle, isComparing, onRemove }: { isPrimary?: boolean; onCompareToggle?: () => void; isComparing?: boolean; onRemove?: () => void }) {
  const [pricePerFt, setPricePerFt] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [unit, setUnit] = useState<'in' | 'cm'>('in');

  const results = useMemo(() => {
    const p = parseFloat(pricePerFt) || 0;
    let l = parseFloat(length) || 0;
    let w = parseFloat(width) || 0;
    let h = parseFloat(height) || 0;

    if (unit === 'cm') {
      l = l * 0.393701;
      w = w * 0.393701;
      h = h * 0.393701;
    }

    const volumeInches = l * w * h;
    const totalCuFt = volumeInches / 1728;
    const totalValue = totalCuFt * p;
    
    const yieldPerInch = volumeInches > 0 ? totalValue / volumeInches : 0;
    const totalLiters = totalCuFt * 28.3168;
    const costPerLiter = totalLiters > 0 ? totalValue / totalLiters : 0;

    return {
      totalValue,
      totalCuFt,
      yieldPerInch,
      costPerLiter,
      hasInputs: p > 0 && l > 0 && w > 0 && h > 0
    };
  }, [pricePerFt, length, width, height, unit]);

  const handleNumericInput = (value: string, setter: (val: string) => void) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setter(value);
    }
  };

  return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl overflow-hidden radial-bg shrink-0"
      >
        <div className="p-6 md:p-8">
          <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-sky-500/20 rounded-xl text-sky-400 border border-sky-500/30">
                <Package size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight uppercase italic text-slate-50">Box Calculator</h1>
                <p className="text-[10px] text-slate-400 font-mono">{isPrimary ? "PRIMARY" : "COMPARISON"} ANALYSIS</p>
              </div>
            </div>
            
            {isPrimary ? (
              <Button
                variant={isComparing ? "secondary" : "outline"}
                size="icon"
                onClick={onCompareToggle}
                className={`h-9 w-9 rounded-full transition-colors ${isComparing ? 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30' : 'border-slate-700 text-slate-400 hover:text-sky-400'}`}
                title="Compare with another configuration"
              >
                <SplitSquareHorizontal size={16} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-9 w-9 rounded-full text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                title="Close comparison"
              >
                <X size={16} />
              </Button>
            )}
          </header>

          <Separator className="bg-slate-800 mb-6" />

          <div className="space-y-6">
            <section className="space-y-3">
              <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                <DollarSign size={12} className="text-emerald-400" />
                Price per Cubic Foot ($)
              </Label>
              <Input
                type="number"
                value={pricePerFt}
                onChange={(e) => handleNumericInput(e.target.value, setPricePerFt)}
                placeholder="e.g. 15.00"
                className="bg-slate-950 border-slate-800 focus:border-emerald-500 h-10 flex-1 text-sm font-mono text-emerald-400 placeholder:text-slate-700"
              />
            </section>

            <section className="space-y-3">
              <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                <Ruler size={12} className="text-sky-400" />
                Dimensions Unit
              </Label>
              <Tabs value={unit} onValueChange={(v) => setUnit(v as 'in' | 'cm')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-950 border border-slate-800">
                  <TabsTrigger value="in" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-xs font-bold">INCHES</TabsTrigger>
                  <TabsTrigger value="cm" className="data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 text-xs font-bold">CENTIMETERS</TabsTrigger>
                </TabsList>
              </Tabs>
            </section>

            <section className="space-y-4">
               <div className="flex items-center justify-between">
                 <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Box Layout</Label>
                 <Button 
                   variant="outline" 
                   size="sm" 
                   className="h-6 px-2 text-[10px] uppercase font-bold border-slate-800 bg-transparent text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 transition-colors"
                   onClick={() => {
                     if (length) {
                       setWidth(length);
                       setHeight(length);
                     }
                   }}
                 >
                   <Package size={10} className="mr-1" /> Make Cubic
                 </Button>
               </div>
               <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-slate-400">LENGTH</Label>
                  <Input
                    type="number"
                    value={length}
                    onChange={(e) => handleNumericInput(e.target.value, setLength)}
                    className="bg-slate-950 border-slate-800 focus:border-sky-500 h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-slate-400">WIDTH</Label>
                  <Input
                    type="number"
                    value={width}
                    onChange={(e) => handleNumericInput(e.target.value, setWidth)}
                    className="bg-slate-950 border-slate-800 focus:border-sky-500 h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-slate-400">HEIGHT</Label>
                  <Input
                    type="number"
                    value={height}
                    onChange={(e) => handleNumericInput(e.target.value, setHeight)}
                    className="bg-slate-950 border-slate-800 focus:border-sky-500 h-9 text-sm font-mono"
                  />
                </div>
              </div>
            </section>

            <Separator className="bg-slate-800" />

            <AnimatePresence mode="wait">
              {results.hasInputs ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between pointer-events-none mb-2">
                    <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Value Analysis</Label>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] font-mono text-slate-400">CALCULATED</span>
                    </div>
                  </div>

                  <Card className="bg-slate-950 border-slate-800 shadow-inner overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <DollarSign size={80} />
                    </div>
                    <CardContent className="p-5 space-y-4 relative z-10">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Total Value</p>
                          <p className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                            ${results.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <ResultItem label="Total Volume" value={`${results.totalCuFt.toFixed(2)} ft³`} unit="" />
                        <div className="h-px bg-slate-800 w-full" />
                        <ResultItem label="Yield per Inch" value={`$${results.yieldPerInch.toFixed(3)}`} unit="" highlight />
                        <ResultItem label="Cost per Liter" value={`$${results.costPerLiter.toFixed(3)}`} unit="/ L" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 text-center bg-slate-950/50 rounded-xl border border-dashed border-slate-800"
                >
                  <Info className="mx-auto mb-2 text-slate-600" size={24} />
                  <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">Awaiting Parameters</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
  );
}

function ResultItem({ label, value, unit, highlight = false }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-[10px] font-mono">
      <span className="text-slate-500 uppercase">{label}</span>
      <div className="text-right">
        <span className={highlight ? "text-emerald-400 font-bold" : "text-sky-400"}>{value}</span>
        {unit && <span className="text-slate-600 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

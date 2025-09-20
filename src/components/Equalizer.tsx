'use client';
import React from 'react';
import { Button } from './ui/button';
import { RotateCcw } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Tipos y Props
export type EqBandCount = 5 | 7 | 10;

interface EqualizerProps {
  bands: number[];
  onBandChange: (bandIndex: number, newValue: number) => void;
  onReset: () => void;
  bandCount: EqBandCount;
  onBandCountChange: (newCount: EqBandCount) => void;
  frequencies: number[];
}

// Hook para la lógica de arrastre (sin cambios)
const useDrag = (
  onDrag: (y: number) => void,
  containerRef: React.RefObject<SVGSVGElement>
) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const activePointRef = React.useRef<SVGElement | null>(null);

  const getPointFromEvent = React.useCallback((e: MouseEvent | TouchEvent) => {
    if (!containerRef.current) return null;
    const svg = containerRef.current;
    const point = svg.createSVGPoint();
    const clientPoint = 'touches' in e ? e.touches[0] : e;
    point.x = clientPoint.clientX;
    point.y = clientPoint.clientY;
    return point.matrixTransform(svg.getScreenCTM()?.inverse());
  }, [containerRef]);

  const handleDragStart = React.useCallback((e: React.MouseEvent<SVGElement> | React.TouchEvent<SVGElement>) => {
    e.preventDefault();
    setIsDragging(true);
    activePointRef.current = e.currentTarget;
  }, []);

  const handleDragMove = React.useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !activePointRef.current) return;
    e.preventDefault();
    const transformedPoint = getPointFromEvent(e);
    if (transformedPoint) {
      onDrag(transformedPoint.y);
    }
  }, [isDragging, onDrag, getPointFromEvent]);

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
    activePointRef.current = null;
  }, []);
  
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  return { handleDragStart };
};

// *** NUEVO SUBCOMPONENTE PARA EL PUNTO DE CONTROL ***
interface ControlPointProps {
    cx: number;
    cy: number;
    color: string;
    index: number;
    svgRef: React.RefObject<SVGSVGElement>;
    onBandChange: (index: number, value: number) => void;
    yToBand: (y: number) => number;
}

const ControlPoint: React.FC<ControlPointProps> = ({ cx, cy, color, index, svgRef, onBandChange, yToBand }) => {
    // El hook se llama aquí, una vez por cada instancia del componente, lo cual es SEGURO.
    const { handleDragStart } = useDrag(y => onBandChange(index, yToBand(y)), svgRef);

    return (
        <circle
            cx={cx}
            cy={cy}
            r="7"
            fill={color}
            stroke="#18181b"
            strokeWidth="2.5"
            onTouchStart={handleDragStart}
            onMouseDown={handleDragStart}
            className="cursor-grab active:cursor-grabbing"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
    );
};


// Componente principal del Ecualizador
const Equalizer: React.FC<EqualizerProps> = ({ bands, onBandChange, onReset, bandCount, onBandCountChange, frequencies }) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const width = 500;
  const height = 235;
  const paddingY = 20;
  const paddingX = 25;
  const MIN_FREQ_LOG = Math.log(20);
  const MAX_FREQ_LOG = Math.log(22000);
  const GAIN_RANGE_DB = 24;

  const freqToX = React.useCallback((freq: number) => {
    const logFreq = Math.log(freq);
    const scale = (logFreq - MIN_FREQ_LOG) / (MAX_FREQ_LOG - MIN_FREQ_LOG);
    return paddingX + scale * (width - 2 * paddingX);
  }, []);

  const bandToY = React.useCallback((bandValue: number) => {
    const scale = bandValue / 100;
    return (height - paddingY - 15) - scale * (height - 2 * paddingY - 15);
  }, []);

  const yToBand = React.useCallback((y: number) => {
    const scale = ((height - paddingY - 15) - y) / (height - 2 * paddingY - 15);
    return Math.max(0, Math.min(100, Math.round(scale * 100)));
  }, []);
  
  const points = React.useMemo(() => bands.map((band, i) => ({
    x: freqToX(frequencies[i]),
    y: bandToY(band),
  })), [bands, bandToY, freqToX, frequencies]);

  const curvePath = React.useMemo(() => {
    if (points.length === 0) return "M 0 0";
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = i > 0 ? points[i - 1] : points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i < points.length - 2 ? points[i + 2] : p2;
        const tension = 0.5;
        const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
        const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
        const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
        const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;
        path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }, [points]);
  
  const yZero = bandToY(50);
  const areaPath = `${curvePath} L ${width - paddingX},${yZero} L ${paddingX},${yZero} Z`;

  const controlPointData = points.map((p, i) => ({
    ...p,
    color: `hsl(${200 + (i * 360 / bands.length)}, 90%, 65%)`,
    index: i,
  }));
  
  const verticalGridLines = [20, 50, 100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000, 10000, 20000];
  const horizontalGridLines = [-12, -6, 0, 6, 12];
  const freqLabels = [50, 100, 300, 800, 1500, 3000, 10000];

  return (
    <div className="bg-zinc-950/70 backdrop-blur-sm border border-zinc-800 rounded-lg p-4 w-full h-full flex flex-col select-none touch-none">
      <div className="flex justify-between items-center mb-4">
        <ToggleGroup type="single" value={String(bandCount)} onValueChange={(value) => onBandCountChange(Number(value) as EqBandCount)} size="sm">
          <ToggleGroupItem value="5">5 BAND</ToggleGroupItem>
          <ToggleGroupItem value="7">7 BAND</ToggleGroupItem>
          <ToggleGroupItem value="10">10 BAND</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={onReset} variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
          <RotateCcw className="size-4 mr-2" />
          Reset
        </Button>
      </div>
      <div className="flex-1 -mx-4 -mb-4 overflow-hidden">
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde047" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#fde047" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <g>
            {verticalGridLines.map(f => <line key={f} x1={freqToX(f)} y1={paddingY} x2={freqToX(f)} y2={height - paddingY - 15} stroke="#3f3f46" strokeWidth="0.5" />)}
            {horizontalGridLines.map(db => {
                const y = bandToY(((db + GAIN_RANGE_DB / 2) / GAIN_RANGE_DB) * 100);
                return (
                  <g key={db}>
                    <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#3f3f46" strokeWidth={db === 0 ? 0.8 : 0.5} strokeDasharray={db !== 0 ? "2 2" : ""} />
                    <text x={paddingX - 5} y={y + 3} textAnchor="end" fill="#71717a" fontSize="10">{db > 0 ? `+${db}` : db}</text>
                  </g>
                );
            })}
            {freqLabels.map(f => <text key={`label-${f}`} x={freqToX(f)} y={height - paddingY + 5} textAnchor="middle" fill="#71717a" fontSize="10">{f >= 1000 ? `${f / 1000}k` : f}</text>)}
          </g>
          <path d={areaPath} fill="url(#areaFill)" />
          <path d={curvePath} fill="none" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 5px #fde047) drop-shadow(0 0 2px #fde047)'}}/>
          
          {/* Renderizando el nuevo componente en el bucle */}
          {controlPointData.map(p => (
            <ControlPoint 
                key={p.index}
                index={p.index}
                cx={p.x}
                cy={p.y}
                color={p.color}
                svgRef={svgRef}
                onBandChange={onBandChange}
                yToBand={yToBand}
            />
          ))}
        </svg>
      </div>
    </div>
  );
};

export default Equalizer;

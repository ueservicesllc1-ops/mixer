
"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

// Componente para las marcas del fader
const FaderMarks = React.memo(() => {
    // Posiciones en porcentaje desde la parte superior
    const marks = [
        { label: "0", position: 20 },   // Ganancia Unitaria (0 dB) - Posición del 80% del slider (100-20)
        { label: "-5", position: 35 },
        { label: "-10", position: 50 },
        { label: "-20", position: 65 },
        { label: "-30", position: 80 },
        { label: "-∞", position: 98 }, // Infinito
    ];

    const totalTicks = 21; // Para ticks más pequeños

    return (
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
             {Array.from({ length: totalTicks }).map((_, i) => {
                const isMajorTick = i % 5 === 0;
                return (
                    <div
                        key={`tick-${i}`}
                        className={cn(
                            "absolute left-1/2 bg-muted-foreground/30",
                             isMajorTick ? "w-2 h-px -translate-x-1" : "w-1 h-px -translate-x-0.5"
                        )}
                        style={{ top: `${(i / (totalTicks - 1)) * 100}%` }}
                    />
                );
            })}

            {marks.map(({ label, position }) => (
                <div
                    key={label}
                    className="absolute -left-3 text-[8px] text-muted-foreground/70"
                    style={{ top: `calc(${position}% - 4px)` }}
                >
                    {label}
                </div>
            ))}
        </div>
    );
});
FaderMarks.displayName = "FaderMarks";


const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'value'> & { 
    value?: number[];
    rangeClassName?: string, 
    thumbClassName?: string,
    trackClassName?: string,
  }
>(({ className, orientation = 'horizontal', trackClassName, rangeClassName, thumbClassName, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    orientation={orientation}
    className={cn(
      "relative flex touch-none select-none items-center group",
      orientation === 'horizontal' ? 'h-5 w-full' : 'h-full w-full flex-col',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className={cn(
        "relative grow overflow-visible",
        orientation === 'horizontal' ? 'h-0.5 w-full' : 'h-full w-0.5 bg-input',
        trackClassName
    )}>
      {orientation === 'vertical' && <FaderMarks />}
      <SliderPrimitive.Range className={cn("absolute bg-primary", rangeClassName)} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb 
        className={cn(
          "block h-8 w-12 rounded-sm bg-stone-700 bg-cover bg-center cursor-pointer relative",
          "ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          thumbClassName
        )}
    >
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-white/0" />
        <div className="absolute inset-x-0 top-[calc(50%-1px)] h-px bg-amber-400/80 shadow-[0_0_2px_theme(colors.amber.400)]" />
    </SliderPrimitive.Thumb>
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

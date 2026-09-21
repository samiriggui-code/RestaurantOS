'use client'

import dynamic from 'next/dynamic'
import type { ApexOptions } from 'apexcharts'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

export type ApexBarChartProps = {
  categories: string[]
  series: number[]
  color?: string
  height?: number
  formatValue?: (v: number) => string
  className?: string
}

/** Barres verticales, thème sombre — remplace l'ancien MiniBarChart fait main. */
export function ApexBarChart({
  categories,
  series,
  color = '#E85D4C',
  height = 160,
  formatValue = (v) => String(v),
  className,
}: ApexBarChartProps) {
  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'inherit',
      animations: { speed: 350 },
      // Sans ça, Apex mesure parfois la largeur du parent flex avant que le flexbox
      // n'ait fini de la calculer, et le SVG déborde du conteneur au lieu de s'y ajuster.
      redrawOnParentResize: true,
      parentHeightOffset: 0,
    },
    theme: { mode: 'dark' },
    colors: [color],
    plotOptions: {
      bar: { borderRadius: 4, columnWidth: categories.length > 12 ? '70%' : '50%' },
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: 'rgba(255,255,255,0.06)',
      strokeDashArray: 3,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
      padding: { left: 8, right: 8 },
    },
    xaxis: {
      categories,
      // Au-delà d'une dizaine de catégories (vue "Mois"), Apex faisait pivoter les
      // libellés en diagonale et le texte débordait de la carte — on plafonne le nombre
      // de libellés affichés (espacés régulièrement) plutôt que de tout écrire à plat.
      tickAmount: categories.length > 10 ? 10 : undefined,
      labels: {
        style: { colors: 'rgba(245,235,224,0.4)', fontSize: '10px' },
        rotate: 0,
        hideOverlappingLabels: true,
        trim: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: 'rgba(245,235,224,0.35)', fontSize: '10px' },
        formatter: (v: number) => formatValue(Math.round(v)),
      },
    },
    tooltip: {
      theme: 'dark',
      y: { formatter: (v: number) => formatValue(v) },
    },
  }

  return (
    <div className={className} style={{ overflow: 'hidden' }}>
      <Chart
        options={options}
        series={[{ name: '', data: series }]}
        type="bar"
        width="100%"
        height={height}
      />
    </div>
  )
}

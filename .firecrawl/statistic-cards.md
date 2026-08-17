Toggle Menu [![ReUI](https://v1.reui.io/brand/logo-icon-light.svg)![ReUI](https://v1.reui.io/brand/logo-icon-dark.svg)](https://v1.reui.io/)

[![ReUI](https://v1.reui.io/brand/logo-text-light.svg)![ReUI](https://v1.reui.io/brand/logo-text-dark.svg)](https://v1.reui.io/)

[Components](https://v1.reui.io/) [UI Blocks](https://v1.reui.io/blocks) [Docs](https://v1.reui.io/docs) [Changelog](https://v1.reui.io/docs/changelog) [Built with ReUI](https://v1.reui.io/built-with-reui)

Search...Search... `/`

2,621

2,966
[X](https://x.com/reui_io)Toggle theme

[Cards](https://v1.reui.io/blocks/cards/cards)

[Statistic CardsNew](https://v1.reui.io/blocks/cards/statistic-cards) [List CardsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Table CardsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Timeline CardsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Form CardsSoon](https://v1.reui.io/blocks/cards/statistic-cards#)

[Charts](https://v1.reui.io/blocks/cards/statistic-cards#)

[Line ChartsNew](https://v1.reui.io/blocks/charts/line-charts) [Area ChartsNew](https://v1.reui.io/blocks/charts/area-charts) [Bar ChartsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Pie ChartsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Doughnut ChartsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Radar ChartsSoon](https://v1.reui.io/blocks/cards/statistic-cards#)

[Navigation](https://v1.reui.io/blocks/cards/statistic-cards#)

[DropdownsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [NavbarsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [TabsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [BreadcrumbsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Vertical NavigationSoon](https://v1.reui.io/blocks/cards/statistic-cards#)

[Lists](https://v1.reui.io/blocks/cards/statistic-cards#)

[Stacked ListsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [TablesSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Data GridsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [TreesSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [FeedsSoon](https://v1.reui.io/blocks/cards/statistic-cards#)

[Forms](https://v1.reui.io/blocks/cards/statistic-cards#)

[Form LayoutsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Form WizardsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Form UploadsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Action FormsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Modal FormsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Drawer FormsSoon](https://v1.reui.io/blocks/cards/statistic-cards#)

[Feedback](https://v1.reui.io/blocks/cards/statistic-cards#)

[AlertsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [DialogsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [NotificationsSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Empty StatesSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Loading StatesSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Overlay ContentSoon](https://v1.reui.io/blocks/cards/statistic-cards#)

[Marketing](https://v1.reui.io/blocks/cards/statistic-cards#)

[HeroSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Pricing TablesSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [FeaturesSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [Call to ActionSoon](https://v1.reui.io/blocks/cards/statistic-cards#) [TestimonialsSoon](https://v1.reui.io/blocks/cards/statistic-cards#)

1. [Blocks](https://v1.reui.io/blocks)
[Cards](https://v1.reui.io/blocks/cards)

# Statistic Cards

15 free modern statistic cards designed to present key metrics and insights.
Each card features unique layouts, data visualizations,
and styling options. Perfect for dashboards, admin panels, and analytics pages.


PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-1

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-1 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-1.json)

### All Orders

122,38015.1%

Vs last month:105,922

### Order Created

1.9M-2%

Vs last month:2.0M

### Organic Sales

$98.1M0.4%

Vs last month:$97.8M

### Active Users

48,2103.7%

Vs last month:46,480

ReUI

cards/statistic-cards/statistic-card-1.tsx

```
import { Badge } from '@/registry/default/ui/badge';
import { Button } from '@/registry/default/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/registry/default/ui/dropdown-menu';
import { ArrowDown, ArrowUp, MoreHorizontal, Pin, Settings, Share2, Trash, TriangleAlert } from 'lucide-react';

const stats = [\
  {\
    title: 'All Orders',\
    value: 122380,\
    delta: 15.1,\
    lastMonth: 105922,\
    positive: true,\
    prefix: '',\
    suffix: '',\
  },\
  {\
    title: 'Order Created',\
    value: 1902380,\
    delta: -2.0,\
    lastMonth: 2002098,\
    positive: false,\
    prefix: '',\
    suffix: '',\
  },\
  {\
    title: 'Organic Sales',\
    value: 98100000,\
    delta: 0.4,\
    lastMonth: 97800000,\
    positive: true,\
    prefix: '$',\
    suffix: 'M',\
    format: (v: number) => `$${(v / 1_000_000).toFixed(1)}M`,\
    lastFormat: (v: number) => `$${(v / 1_000_000).toFixed(1)}M`,\
  },\
  {\
    title: 'Active Users',\
    value: 48210,\
    delta: 3.7,\
    lastMonth: 46480,\
    positive: true,\
    prefix: '',\
    suffix: '',\
  },\
];

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

export default function StatisticCard1() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <div className="grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="border-0">
              <CardTitle className="text-muted-foreground text-sm font-medium">{stat.title}</CardTitle>
              <CardToolbar>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="dim" size="sm" mode="icon" className="-me-1.5">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem>
                      <Settings />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <TriangleAlert /> Add Alert
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Pin /> Pin to Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 /> Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      <Trash />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-medium text-foreground tracking-tight">
                  {stat.format ? stat.format(stat.value) : stat.prefix + formatNumber(stat.value) + stat.suffix}
                </span>
                <Badge variant={stat.positive ? 'success' : 'destructive'} appearance="light">
                  {stat.delta > 0 ? <ArrowUp /> : <ArrowDown />}
                  {stat.delta}%
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-2 border-t pt-2.5">
                Vs last month:{' '}
                <span className="font-medium text-foreground">
                  {stat.lastFormat
                    ? stat.lastFormat(stat.lastMonth)
                    : stat.prefix + formatNumber(stat.lastMonth) + stat.suffix}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-2

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-2 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-2.json)

### Total Sales

$892.2M0.2%

Vs last month:$889.1M

### New Customers

12,8003.1%

Vs last month:12,400

### Refunds

320-1.2%

Vs last month:340

### Churn Rate

2.3%-0.1%

Vs last month:2.4%

ReUI

cards/statistic-cards/statistic-card-2.tsx

```
import { Badge } from '@/registry/default/ui/badge';
import { Button } from '@/registry/default/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/registry/default/ui/dropdown-menu';
import { ArrowDown, ArrowUp, MoreHorizontal, Pin, Settings, Share2, Trash, TriangleAlert } from 'lucide-react';

const stats = [\
  {\
    title: 'Total Sales',\
    value: 892200000,\
    delta: 0.2,\
    lastMonth: 889100000,\
    positive: true,\
    prefix: '$',\
    suffix: 'M',\
    format: (v: number) => `$${(v / 1_000_000).toFixed(1)}M`,\
    lastFormat: (v: number) => `$${(v / 1_000_000).toFixed(1)}M`,\
    bg: 'bg-zinc-950',\
    svg: (\
      <svg\
        className="absolute right-0 top-0 h-full w-2/3 pointer-events-none"\
        viewBox="0 0 300 200"\
        fill="none"\
        style={{ zIndex: 0 }}\
      >\
        <circle cx="220" cy="100" r="90" fill="#fff" fillOpacity="0.08" />\
        <circle cx="260" cy="60" r="60" fill="#fff" fillOpacity="0.10" />\
        <circle cx="200" cy="160" r="50" fill="#fff" fillOpacity="0.07" />\
        <circle cx="270" cy="150" r="30" fill="#fff" fillOpacity="0.12" />\
      </svg>\
    ),\
  },\
  {\
    title: 'New Customers',\
    value: 12800,\
    delta: 3.1,\
    lastMonth: 12400,\
    positive: true,\
    prefix: '',\
    suffix: '',\
    bg: 'bg-fuchsia-600',\
    svg: (\
      <svg\
        className="absolute right-0 top-0 w-48 h-48 pointer-events-none"\
        viewBox="0 0 200 200"\
        fill="none"\
        style={{ zIndex: 0 }}\
      >\
        <defs>\
          <filter id="blur2" x="-20%" y="-20%" width="140%" height="140%">\
            <feGaussianBlur stdDeviation="10" />\
          </filter>\
        </defs>\
        <ellipse cx="170" cy="60" rx="40" ry="18" fill="#fff" fillOpacity="0.13" filter="url(#blur2)" />\
        <rect x="120" y="20" width="60" height="20" rx="8" fill="#fff" fillOpacity="0.10" />\
        <polygon points="150,0 200,0 200,50" fill="#fff" fillOpacity="0.07" />\
        <circle cx="180" cy="100" r="14" fill="#fff" fillOpacity="0.16" />\
      </svg>\
    ),\
  },\
  {\
    title: 'Refunds',\
    value: 320,\
    delta: -1.2,\
    lastMonth: 340,\
    positive: false,\
    prefix: '',\
    suffix: '',\
    bg: 'bg-blue-600',\
    svg: (\
      <svg\
        className="absolute right-0 top-0 w-48 h-48 pointer-events-none"\
        viewBox="0 0 200 200"\
        fill="none"\
        style={{ zIndex: 0 }}\
      >\
        <defs>\
          <filter id="blur3" x="-20%" y="-20%" width="140%" height="140%">\
            <feGaussianBlur stdDeviation="12" />\
          </filter>\
        </defs>\
        <rect x="120" y="0" width="70" height="70" rx="35" fill="#fff" fillOpacity="0.09" filter="url(#blur3)" />\
        <ellipse cx="170" cy="80" rx="28" ry="12" fill="#fff" fillOpacity="0.12" />\
        <polygon points="200,0 200,60 140,0" fill="#fff" fillOpacity="0.07" />\
        <circle cx="150" cy="30" r="10" fill="#fff" fillOpacity="0.15" />\
      </svg>\
    ),\
  },\
  {\
    title: 'Churn Rate',\
    value: 2.3,\
    delta: -0.1,\
    lastMonth: 2.4,\
    positive: false,\
    prefix: '',\
    suffix: '%',\
    bg: 'bg-teal-600',\
    svg: (\
      <svg\
        className="absolute right-0 top-0 w-48 h-48 pointer-events-none"\
        viewBox="0 0 200 200"\
        fill="none"\
        style={{ zIndex: 0 }}\
      >\
        <defs>\
          <filter id="blur4" x="-20%" y="-20%" width="140%" height="140%">\
            <feGaussianBlur stdDeviation="16" />\
          </filter>\
        </defs>\
        <polygon points="200,0 200,100 100,0" fill="#fff" fillOpacity="0.09" />\
        <ellipse cx="170" cy="40" rx="30" ry="18" fill="#fff" fillOpacity="0.13" filter="url(#blur4)" />\
        <rect x="140" y="60" width="40" height="18" rx="8" fill="#fff" fillOpacity="0.10" />\
        <circle cx="150" cy="30" r="14" fill="#fff" fillOpacity="0.18" />\
        <line x1="120" y1="0" x2="200" y2="80" stroke="#fff" strokeOpacity="0.08" strokeWidth="6" />\
      </svg>\
    ),\
  },\
];

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

export default function StatisticCard2() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <div className="grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className={`relative overflow-hidden ${stat.bg} text-white`}>
            <CardHeader className="border-0 z-10 relative">
              <CardTitle className="text-white/90 text-sm font-medium">{stat.title}</CardTitle>
              <CardToolbar>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="dim" size="sm" mode="icon" className="-me-1.5 text-white/80 hover:text-white">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem>
                      <Settings /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <TriangleAlert /> Add Alert
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Pin /> Pin to Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 /> Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      <Trash /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-2.5 z-10 relative">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-semibold tracking-tight">
                  {stat.format ? stat.format(stat.value) : stat.prefix + formatNumber(stat.value) + stat.suffix}
                </span>
                <Badge className="bg-white/20 font-semibold">
                  {stat.delta > 0 ? <ArrowUp /> : <ArrowDown />}
                  {stat.delta}%
                </Badge>
              </div>
              <div className="text-xs text-white/80 mt-2 border-t border-white/20 pt-2.5">
                Vs last month:{' '}
                <span className="font-medium text-white">
                  {stat.lastFormat
                    ? stat.lastFormat(stat.lastMonth)
                    : stat.prefix + formatNumber(stat.lastMonth) + stat.suffix}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-3

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-3 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-3.json)

### Subscription Alerts

This Month

Total Revenue

$128,400

Subscriptions

312

Free

Pro

Enterprise

Expiring Soon

[View all](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-3#)

Acme CorpEnterprise

in 3d

[Renew](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-3#)

Beta LLCPro

in 5d

[Renew](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-3#)

Gamma IncPro

in 7d

[Renew](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-3#)

ReUI

cards/statistic-cards/statistic-card-3.tsx

```
import { Badge } from '@/registry/default/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/registry/default/ui/select';
import { Separator } from '@/registry/default/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/registry/default/ui/tooltip';
import { Info } from 'lucide-react';

export default function StatisticCard3() {
  const alerts = [\
    { name: 'Acme Corp', plan: 'Enterprise', daysLeft: 3, renewUrl: '#' },\
    { name: 'Beta LLC', plan: 'Pro', daysLeft: 5, renewUrl: '#' },\
    { name: 'Gamma Inc', plan: 'Pro', daysLeft: 7, renewUrl: '#' },\
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full md:w-[450px]">
        <CardHeader className="border-0 py-6">
          <CardTitle>Subscription Alerts</CardTitle>
          <CardToolbar>
            <Select defaultValue="this-month">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
                <SelectItem value="last-year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </CardToolbar>
        </CardHeader>
        <CardContent>
          {/* Stats Row */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Total Revenue</div>
              <div className="text-2xl font-bold text-foreground">$128,400</div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Subscriptions</div>
              <div className="text-2xl font-bold text-foreground">312</div>
            </div>
          </div>
          {/* Segmented Progress Bar */}
          <div className="flex items-center gap-0.5 w-full h-2.5 rounded-full overflow-hidden mb-3.5 bg-muted">
            <div className="bg-teal-400 h-full" style={{ width: '60%' }} />
            <div className="bg-destructive h-full" style={{ width: '30%' }} />
            <div className="bg-amber-400 h-full" style={{ width: '10%' }} />
          </div>
          {/* Legend */}
          <div className="flex items-center gap-5 mb-6">
            <div className="flex items-center gap-1 text-xs text-teal-600">
              <span className="size-2 rounded-full bg-teal-400 inline-block" /> Free
            </div>
            <div className="flex items-center gap-1 text-xs text-destructive">
              <span className="size-2 rounded-full bg-destructive inline-block" /> Pro
            </div>
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <span className="size-2 rounded-full bg-amber-400 inline-block" /> Enterprise
              <span className="ms-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3.5 text-muted-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <span>Enterprise plans are custom contracts with premium support.</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </div>
          </div>
          {/* Expiring Soon List */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-xs text-muted-foreground tracking-wide uppercase">Expiring Soon</div>
            <a href="#" className="text-sm text-primary font-medium hover:underline">
              View all
            </a>
          </div>
          {alerts.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2.5 mb-2 last:mb-0"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-foreground">{item.name}</span>
                <Badge size="sm" variant="outline">
                  {item.plan}
                </Badge>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-muted-foreground">
                  in <span className="font-semibold text-foreground">{item.daysLeft}d</span>
                </span>
                <Separator orientation="vertical" className="h-3 bg-accent-foreground/20" />
                <a href={item.renewUrl} className="text-xs text-primary font-medium hover:underline">
                  Renew
                </a>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-4

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-4 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-4.json)

### Leads Overview

This Month

5421.43%

New leads

198

Returning leads

Top SourceLinkedIn

Conversion Rate12.8%

ReUI

cards/statistic-cards/statistic-card-4.tsx

```
import { Badge } from '@/registry/default/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/registry/default/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/registry/default/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const leadsData = {
  newLeads: 54,
  returningLeads: 198,
  newPercent: 21.43,
  returningPercent: 78.57,
  topSource: 'LinkedIn',
  conversionRate: 12.8,
};

export default function StatisticCard4() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full md:w-[450px]">
        <CardHeader className="border-0 pt-6 pb-5">
          <CardTitle>Leads Overview</CardTitle>
          <CardToolbar>
            <Select defaultValue="this-month">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
                <SelectItem value="last-year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </CardToolbar>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-x-6 mb-4">
            {/* New Leads */}
            <div className="flex-1 flex flex-col items-start gap-1">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-2xl font-bold text-foreground">{leadsData.newLeads}</span>
                <Badge size="sm" variant="primary" appearance="light">
                  {leadsData.newPercent}%
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground font-medium">New leads</span>
              {/* Solid Progress Bar */}
              <div className="w-full mt-1">
                <div className="h-2.5 rounded-xs bg-muted overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-xs transition-all"
                    style={{ width: `${leadsData.newPercent}%` }}
                  />
                </div>
              </div>
            </div>
            {/* Returning Leads */}
            <div className="flex-1 flex flex-col items-start gap-1 border-s border-muted-foreground/10 ps-6">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-2xl font-bold text-foreground">{leadsData.returningLeads}</span>
              </div>
              <span className="text-sm text-muted-foreground font-medium">Returning leads</span>
              {/* Dotted Bar */}
              <div className="w-full mt-1 flex gap-0.5">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-2.5 w-0.5 rounded-full flex-1',
                      i < Math.round((leadsData.returningPercent / 100) * 30) ? 'bg-green-500' : 'bg-muted',
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Extra Details */}
          <div className="flex items-center gap-x-4 mb-1.5">
            <div className="flex flex-col flex-1 gap-0.5">
              <span className="text-xs text-muted-foreground">Top Source</span>
              <span className="text-sm font-medium text-foreground">{leadsData.topSource}</span>
            </div>
            <div className="flex flex-col flex-1 gap-0.5 ps-7.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Conversion Rate
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3.5 text-muted-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <span>Percentage of leads converted to customers.</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <span className="text-sm font-medium text-foreground">{leadsData.conversionRate}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-5

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-5 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-5.json)

### Balance

Topup

$10,976.95+5.7%

USD30%

GBP20%

EUR15%

JPY20%

CNY15%

ReUI

cards/statistic-cards/statistic-card-5.tsx

```
import { Button } from '@/registry/default/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import { BanknoteArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const balanceData = {
  balance: 10976.95,
  delta: 5.7,
  currencies: [\
    { code: 'USD', percent: 30, color: 'bg-white' },\
    { code: 'GBP', percent: 20, color: 'bg-indigo-400' },\
    { code: 'EUR', percent: 15, color: 'bg-blue-500' },\
    { code: 'JPY', percent: 20, color: 'bg-violet-600' },\
    { code: 'CNY', percent: 15, color: 'bg-fuchsia-600' },\
  ],
};

export default function StatisticCard5() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full max-w-xl rounded-2xl shadow-xl border-0 bg-zinc-900  text-white">
        <CardHeader className="border-0 pb-2 pt-6">
          <CardTitle className="text-lg font-semibold text-zinc-400">Balance</CardTitle>
          <CardToolbar>
            <Button className="bg-zinc-800 text-zinc-100 border-zinc-800 hover:bg-zinc-700 hover:text-zinc-100">
              <BanknoteArrowUp />
              Topup
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 mb-5">
            <span className="text-3xl font-bold tracking-tight text-white">
              ${balanceData.balance.toLocaleString()}
            </span>
            <span className="text-base font-semibold text-green-400 ms-2">+{balanceData.delta}%</span>
          </div>

          <div className="border-b border-zinc-700 mb-6" />

          {/* Segmented Progress Bar */}
          <div className="flex items-center gap-1.5 w-full mb-3">
            {balanceData.currencies.map((cur) => (
              <div
                key={cur.code}
                className="space-y-2.5"
                style={{
                  width: `${cur.percent}%`,
                }}
              >
                <div className={cn(cur.color, 'h-2.5 w-full overflow-hidden  rounded-sm transition-all')} />

                <div key={cur.code} className="flex flex-col items-start flex-1">
                  <span className="text-xs text-zinc-400 font-medium">{cur.code}</span>
                  <span className="text-base font-semibold text-white">{cur.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-6

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-6 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-6.json)

### Staff PerformanceSales Manager

Q3 Performance

27

Deals Closed

+12%

$182.4k

Revenue

+6%

72%

Conversion

-3%

Pipeline Progress76%

Recent Activity

- Closed deal with FinSight Inc.Today
- 3 new leads added to Pipeline.Yesterday
- Follow-up scheduled.2 days ago

ScheduleFull Report

ReUI

cards/statistic-cards/statistic-card-6.tsx

```
'use client';

import { Badge } from '@/registry/default/ui/badge';
import { Button } from '@/registry/default/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/registry/default/ui/dropdown-menu';
import { Progress } from '@/registry/default/ui/progress';
import { Separator } from '@/registry/default/ui/separator';
import {
  BadgeAlertIcon,
  CheckCircle,
  MoreHorizontal,
  Pin,
  Settings,
  Share2,
  Trash,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatisticCard6() {
  const performance = [\
    {\
      label: 'Deals Closed',\
      value: 27,\
      trend: 12,\
      trendDir: 'up',\
    },\
    {\
      label: 'Revenue',\
      value: '$182.4k',\
      trend: 6,\
      trendDir: 'up',\
    },\
    {\
      label: 'Conversion',\
      value: '72%',\
      trend: 3,\
      trendDir: 'down',\
    },\
  ];
  const pipelineProgress = 76;
  const activity = [\
    {\
      text: 'Closed deal with FinSight Inc.',\
      date: 'Today',\
      state: 'secondary',\
      color: 'text-green-500',\
    },\
    {\
      text: '3 new leads added to Pipeline.',\
      date: 'Yesterday',\
      state: 'secondary',\
      color: 'text-green-500',\
    },\
    {\
      text: 'Follow-up scheduled.',\
      date: '2 days ago',\
      state: 'destructive',\
      color: 'text-destructive',\
    },\
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      {/* Card */}
      <Card className="w-full md:w-96">
        <CardHeader className="h-auto py-4">
          <CardTitle className="flex flex-col gap-1">
            <span>Staff Performance</span>
            <span className="text-xs font-normal text-muted-foreground">Sales Manager</span>
          </CardTitle>
          <CardToolbar>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="dim" size="sm" mode="icon" className="-me-1.5">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem>
                  <Settings />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <TriangleAlert /> Add Alert
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Pin /> Pin to Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share2 /> Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <Trash />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Q3 Performance */}
          <div>
            <div className="font-medium text-sm mb-2.5 text-accent-foreground">Q3 Performance</div>
            <div className="grid grid-cols-3 gap-2">
              {performance.map((item) => (
                <div className="flex flex-col items-start justify-start" key={item.label}>
                  <div className="text-xl font-bold text-foreground">{item.value}</div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">{item.label}</div>

                  <span
                    className={cn(
                      'flex items-center gap-0.5 text-xs font-semibold',
                      item.trendDir === 'up' ? 'text-green-500' : 'text-destructive',
                    )}
                  >
                    {item.trendDir === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {item.trendDir === 'up' ? '+' : '-'}
                    {item.trend}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Pipeline Progress */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-medium text-foreground">Pipeline Progress</span>
              <span className="text-xs font-semibold text-foreground">{pipelineProgress}%</span>
            </div>
            <Progress value={pipelineProgress} className="bg-muted" />
          </div>

          <Separator />

          {/* Recent Activity */}
          <div>
            <div className="font-medium text-sm text-foreground mb-2.5">Recent Activity</div>
            <ul className="space-y-2">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle className={cn('w-3.5 h-3.5', a.color)} />
                    <span className="text-xs text-foreground truncate">{a.text}</span>
                  </span>
                  <Badge variant={a.state === 'secondary' ? 'secondary' : 'destructive'} appearance="light" size="sm">
                    {a.date}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2.5 h-auto py-3.5">
          <Button variant="outline" className="flex-1">
            Schedule
          </Button>
          <Button variant="primary" className="flex-1">
            Full Report
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-7

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-7 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-7.json)

Total Sales & Cost

Last 60 days

$956.82k+5.4%

+8.20k vs prev. 60 days

New Customers

This quarter

1,245+3.2%

+39 vs last quarter

Churn Rate

Last 30 days

2.8%-1.1%

-0.3% vs prev. 30 days

ReUI

cards/statistic-cards/statistic-card-7.tsx

```
import { Badge } from '@/registry/default/ui/badge';
import { Card, CardContent } from '@/registry/default/ui/card';
import { ArrowUpRight, TrendingDown, UserPlus } from 'lucide-react';

const cards = [\
  {\
    title: 'Total Sales & Cost',\
    subtitle: 'Last 60 days',\
    value: '$956.82k',\
    valueColor: 'text-green-600',\
    badge: {\
      color: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',\
      icon: ArrowUpRight,\
      iconColor: 'text-green-500',\
      text: '+5.4%',\
    },\
    subtext: (\
      <span className="text-green-600 font-medium">\
        +8.20k <span className="text-muted-foreground font-normal">vs prev. 60 days</span>\
      </span>\
    ),\
  },\
  {\
    title: 'New Customers',\
    subtitle: 'This quarter',\
    value: '1,245',\
    valueColor: 'text-blue-600',\
    badge: {\
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',\
      icon: UserPlus,\
      iconColor: 'text-blue-500',\
      text: '+3.2%',\
    },\
    subtext: (\
      <span className="text-blue-600 font-medium">\
        +39 <span className="text-muted-foreground font-normal">vs last quarter</span>\
      </span>\
    ),\
  },\
  {\
    title: 'Churn Rate',\
    subtitle: 'Last 30 days',\
    value: '2.8%',\
    valueColor: 'text-red-500',\
    badge: {\
      color: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',\
      icon: TrendingDown,\
      iconColor: 'text-red-500',\
      text: '-1.1%',\
    },\
    subtext: (\
      <span className="text-red-500 font-medium">\
        -0.3% <span className="text-muted-foreground font-normal">vs prev. 30 days</span>\
      </span>\
    ),\
  },\
];

export default function StatisticCard7() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-12">
      <div className="@container grow w-full">
        <div className="grid grid-cols-1 @3xl:grid-cols-3 bg-background overflow-hidden rounded-xl border border-border">
          {cards.map((card, i) => (
            <Card
              key={i}
              className="border-0 shadow-none rounded-none border-y @3xl:border-x @3xl:border-y-0 border-border last:border-0 first:border-0"
            >
              <CardContent className="flex flex-col h-full space-y-6 justify-between">
                {/* Title & Subtitle */}
                <div className="space-y-0.25">
                  <div className="text-lg font-semibold text-foreground">{card.title}</div>
                  <div className="text-sm text-muted-foreground">{card.subtitle}</div>
                </div>

                {/* Information */}
                <div className="flex-1 flex flex-col gap-1.5 justify-between grow">
                  {/* Value & Delta */}
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold tracking-tight">{card.value}</span>
                    <Badge
                      className={`${card.badge.color} px-2 py-1 rounded-full text-sm font-medium flex items-center gap-1 shadow-none`}
                    >
                      <card.badge.icon className={`w-3 h-3 ${card.badge.iconColor}`} />
                      {card.badge.text}
                    </Badge>
                  </div>
                  {/* Subtext */}
                  <div className="text-sm">{card.subtext}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-8

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-8 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-8.json)

+12.8%

Active Projects

17

From Jan 01 - Jul 30, 2024

+3.7%

Orders Processed

3,421

From Jan 01 - Jul 30, 2024

-2.1%

Churned Users

89

From Jan 01 - Jul 30, 2024

ReUI

cards/statistic-cards/statistic-card-8.tsx

```
import { Badge } from '@/registry/default/ui/badge';
import { Card, CardContent } from '@/registry/default/ui/card';
import { Briefcase, ShoppingCart, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const cards = [\
  {\
    icon: Briefcase,\
    iconColor: 'text-green-600',\
    title: 'Active Projects',\
    badge: {\
      color: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',\
      icon: TrendingUp,\
      iconColor: 'text-green-500',\
      text: '+12.8%',\
    },\
    value: 17,\
    dateRange: 'From Jan 01 - Jul 30, 2024',\
  },\
  {\
    icon: ShoppingCart,\
    iconColor: 'text-blue-600',\
    title: 'Orders Processed',\
    badge: {\
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',\
      icon: TrendingUp,\
      iconColor: 'text-blue-500',\
      text: '+3.7%',\
    },\
    value: 3421,\
    dateRange: 'From Jan 01 - Jul 30, 2024',\
  },\
  {\
    icon: Users,\
    iconColor: 'text-pink-600',\
    title: 'Churned Users',\
    badge: {\
      color: 'bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400',\
      icon: TrendingDown,\
      iconColor: 'text-pink-500',\
      text: '-2.1%',\
    },\
    value: 89,\
    dateRange: 'From Jan 01 - Jul 30, 2024',\
  },\
];

export default function StatisticCard8() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-12">
      {/* Container */}
      <div className="@container grow w-full">
        {/* Grid */}
        <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6">
          {/* Cards */}
          {cards.map((card, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col h-full">
                {/* Title & Badge */}
                <div className="flex items-center justify-between mb-8">
                  <card.icon className={cn('size-6', card.iconColor)} />

                  <Badge className={cn('px-2 py-1 rounded-full', card.badge.color)}>
                    <card.badge.icon className={`w-3 h-3 ${card.badge.iconColor}`} />
                    {card.badge.text}
                  </Badge>
                </div>

                {/* Value & Date Range */}
                <div className="flex-1 flex flex-col justify-between grow">
                  {/* Value */}
                  <div>
                    <div className="text-base font-medium text-muted-foreground mb-1">{card.title}</div>
                    <div className="text-3xl font-bold text-foreground mb-6">{card.value.toLocaleString()}</div>
                  </div>
                  <div className="pt-3 border-t border-muted text-xs text-muted-foreground font-medium">
                    {card.dateRange}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-9

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-9 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-9.json)

### Tasks Overview

This Month

Tasks Done12

28Backlog

14In Progress

8In Review

AI prediction to finish all tasks: 1w 4d 2h

ReUI

cards/statistic-cards/statistic-card-9.tsx

```
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import { Progress } from '@/registry/default/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/registry/default/ui/select';

export default function StatisticCard6() {
  const [progress, setProgress] = useState(13);

  useEffect(() => {
    const timer = setTimeout(() => setProgress(66), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full md:w-[450px]">
        <CardHeader>
          <CardTitle>Tasks Overview</CardTitle>
          <CardToolbar>
            <Select defaultValue="this-month">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
                <SelectItem value="last-year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </CardToolbar>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Progress bar and done tasks */}
          <div className="grow mb-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">Tasks Done</span>
              <span className="text-sm font-semibold text-success">12</span>
            </div>
            <Progress value={progress} />
          </div>

          {/* Task summary */}
          <div className="space-y-6">
            {/* Tasks list */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="flex flex-col items-center justify-center bg-muted/60 rounded-lg py-3.5 px-2 gap-1">
                <span className="text-lg font-bold text-green-500">28</span>
                <span className="text-xs text-accent-foreground">Backlog</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-muted/60 rounded-lg py-3.5 px-2 gap-1">
                <span className="text-lg font-bold text-yellow-500">14</span>
                <span className="text-xs text-accent-foreground">In Progress</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-muted/60 rounded-lg py-3.5 px-2 gap-1">
                <span className="text-lg font-bold text-violet-500">8</span>
                <span className="text-xs text-accent-foreground">In Review</span>
              </div>
            </div>

            {/* AI prediction footer */}
            <div className="text-xs text-muted-foreground text-center">
              AI prediction to finish all tasks: <span className="font-semibold text-foreground">1w 4d 2h</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-10

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-10 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-10.json)

### Total Revenue

$ 1,120,500USD

-12.7%decreased from last quarter

Avg. Subscription Value:$320

Enterprise Clients:42

ReUI

cards/statistic-cards/statistic-card-10.tsx

```
import { Badge } from '@/registry/default/ui/badge';
import { Button } from '@/registry/default/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/registry/default/ui/dropdown-menu';
import { BarChart2, MoreHorizontal } from 'lucide-react';

export default function StatisticCard10() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="border-0 py-6 min-h-auto">
          <CardTitle className="inline-flex items-center gap-2">
            <BarChart2 className="size-8 text-primary" />
            Total Revenue
          </CardTitle>
          <CardToolbar>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="dim" size="sm" mode="icon">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Export Data</DropdownMenuItem>
                <DropdownMenuItem>Pin to Dashboard</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardToolbar>
        </CardHeader>
        <CardContent className="flex flex-col justify-between gap-3.5">
          <div className="space-y-3.5">
            {/* Revenue */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="text-3xl font-bold text-foreground tracking-tight">$ 1,120,500</span>
              <span className="text-xs text-muted-foreground font-medium leading-none">USD</span>
            </div>

            {/* Revenue trend */}
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="success" appearance="light">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
                  <path
                    d="M3 5.5L7 9.5L11 5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                -12.7%
              </Badge>
              <span className="text-sm text-muted-foreground">decreased from last quarter</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="p-2.5 bg-muted/60 flex items-center justify-between rounded-lg">
              <span className="text-sm text-accent-foreground">Avg. Subscription Value:</span>
              <span className="text-base font-semibold text-foreground">$320</span>
            </div>
            <div className="p-2.5 bg-muted/60 flex items-center justify-between rounded-lg">
              <span className="text-sm text-accent-foreground">Enterprise Clients:</span>
              <span className="text-base font-semibold text-foreground">42</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-11

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-11 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-11.json)

### API Call Quota

View API usage

Used calls: 2000$4.00

3000 free calls leftof 5000 monthly quota

Quota renews onSeptember 1, 2025

ReUI

cards/statistic-cards/statistic-card-11.tsx

```
import { Button } from '@/registry/default/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import { Progress } from '@/registry/default/ui/progress';

export default function StatisticCard11() {
  const used = 2000;
  const total = 5000;
  const remaining = total - used;
  const percent = (used / total) * 100;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="border-0 min-h-auto pt-6 pb-4">
          <CardTitle>API Call Quota</CardTitle>
          <CardToolbar>
            <Button variant="outline" size="sm" className="font-medium">
              View API usage
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="flex flex-col space-y-6">
          <div className="grow space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Used calls: <span className="font-semibold text-foreground">{used}</span>
              </span>
              <span className="text-base font-semibold text-foreground">${(used * 0.002).toFixed(2)}</span>
            </div>

            <div>
              <Progress value={percent} className="bg-muted" indicatorClassName="bg-indigo-500" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{remaining} free calls left</span>
              <span className="text-xs text-muted-foreground">of {total} monthly quota</span>
            </div>
          </div>

          <div className="rounded-xl bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>Quota renews on</span>
            <span className="font-medium text-foreground">September 1, 2025</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-12

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-12 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-12.json)

320

Support Tickets

12 Open, 308 Closed

98%

Resolved

+2.1% this month

4.8

Satisfaction Rate

Avg. (out of 5)

ReUI

cards/statistic-cards/statistic-card-12.tsx

```
import { cn } from '@/registry/default/lib/utils';
import { Badge } from '@/registry/default/ui/badge';
import { Card, CardContent } from '@/registry/default/ui/card';
import { CheckCircle2, LifeBuoy, Smile } from 'lucide-react';

const cards = [\
  {\
    icon: LifeBuoy,\
    iconBg: 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',\
    value: 320,\
    label: 'Support Tickets',\
    info: (\
      <Badge variant="secondary" appearance="light">\
        12 Open, 308 Closed\
      </Badge>\
    ),\
  },\
  {\
    icon: CheckCircle2,\
    iconBg: 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',\
    value: '98%',\
    label: 'Resolved',\
    info: (\
      <Badge variant="success" appearance="light">\
        +2.1% this month\
      </Badge>\
    ),\
  },\
  {\
    icon: Smile,\
    iconBg: 'border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400',\
    value: '4.8',\
    label: 'Satisfaction Rate',\
    info: (\
      <Badge variant="secondary" appearance="light">\
        Avg. (out of 5)\
      </Badge>\
    ),\
  },\
];

export default function StatisticCard12() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <div className="@container grow w-full">
        <div className="grow grid grid-cols-1 @3xl:grid-cols-3 gap-5 max-w-5xl">
          {cards.map((card, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col items-start gap-6">
                {/* Icon */}
                <div className={cn(`rounded-xl flex items-center justify-center size-12 border`, card.iconBg)}>
                  <card.icon className="size-6" />
                </div>

                {/* Value & Label */}
                <div className="space-y-0.5">
                  <div className="text-2xl font-bold text-foreground leading-none">{card.value}</div>
                  <div className="text-sm text-muted-foreground">{card.label}</div>
                </div>

                {card.info}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-13

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-13 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-13.json)

### Compliance Checks

20/16 checks passing67% assigned

ReUI

cards/statistic-cards/statistic-card-13.tsx

```
import { Button } from '@/registry/default/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/registry/default/ui/dropdown-menu';
import { MoreVertical, Pin, Settings, Share2, ShieldCheck, Trash, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatisticCard13() {
  const total = 30;
  const passing = 20;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="border-0 min-h-auto py-5">
          <CardTitle className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Compliance Checks</span>
          </CardTitle>
          <CardToolbar>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="dim" size="sm" mode="icon" className="-me-1.5">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem>
                  <Settings />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <TriangleAlert /> Export Report
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Pin /> Configure Alerts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Share2 /> Run Manual Check
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ShieldCheck /> View History
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardToolbar>
        </CardHeader>

        <CardContent className="space-y-2.5">
          {/* Progress Bar */}
          <div className="flex grow gap-1">
            {[...Array(total)].map((_, i) => (
              <span
                key={i}
                className={cn(
                  `inline-block w-3 h-4 rounded-sm border transition-colors`,
                  i < passing ? 'bg-primary border-primary' : 'bg-muted border-muted',
                )}
              />
            ))}
          </div>

          {/* Passing Checks */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{passing}/16 checks passing</span>
            <span className="font-semibold text-foreground">{Math.round((passing / total) * 100)}% assigned</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-14

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-14 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-14.json)

### Feature Adoption    Best adoption report

84%

ReUI

cards/statistic-cards/statistic-card-14.tsx

```
'use client';

import * as React from 'react';
import { Badge } from '@/registry/default/ui/badge';
import { Button } from '@/registry/default/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/registry/default/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/registry/default/ui/dropdown-menu';
import {
  ArrowUpRight,
  Minus as MinusIcon,
  MoreVertical,
  Pin,
  Settings,
  Share2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

const bars = [6, 6, 5, 5, 4, 4, 3, 0];
const maxBars = Math.max(...bars);

const barInsights = [\
  {\
    date: '24 Feb 2025',\
    growth: 8.2,\
    direction: 'up',\
    note: 'Feature launch week. Strong adoption spike.',\
  },\
  {\
    date: '08 Mar 2025',\
    growth: 7.5,\
    direction: 'up',\
    note: 'Onboarding improvements led to a 7.5% boost in adoption.',\
  },\
  {\
    date: '15 Mar 2025',\
    growth: 2.1,\
    direction: 'up',\
    note: 'Steady growth as more teams enabled the feature.',\
  },\
  {\
    date: '22 Apr 2025',\
    growth: 0.0,\
    direction: 'neutral',\
    note: 'Temporary plateau after a minor bug was reported.',\
  },\
  {\
    date: '29 May 2025',\
    growth: 0.0,\
    direction: 'neutral',\
    note: 'Seasonal dip, many users on vacation.',\
  },\
  {\
    date: '06 Jun 2025',\
    growth: 0.0,\
    direction: 'neutral',\
    note: 'No significant change, awaiting next release.',\
  },\
  {\
    date: '13 Jul 2025',\
    growth: 1.4,\
    direction: 'up',\
    note: 'Beta feature feedback positive, slight increase.',\
  },\
  {\
    date: '20 Jul 2025',\
    growth: 0.0,\
    direction: 'neutral',\
    note: 'Stable week, engagement holding steady.',\
  },\
];

function GrowthBadge({ direction, growth }: { direction: string; growth: number }) {
  if (direction === 'up')
    return (
      <Badge className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
        <ArrowUpRight className="w-3 h-3" />+{growth}%
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
      <MinusIcon className="w-3 h-3" />
      {growth}%
    </Badge>
  );
}

function getBarColor(direction: string, j: number, height: number) {
  if (height === 0) return 'bg-muted';

  // Even color progression from intense to neutral
  const barColors = [\
    'bg-indigo-600',\
    'bg-indigo-500',\
    'bg-indigo-400',\
    'bg-indigo-300',\
    'bg-indigo-200',\
    'bg-indigo-100',\
  ];
  return j < height ? barColors[j] : 'bg-muted';
}

export default function StatisticCard14() {
  const barRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="border-0 min-h-auto pt-5 pb-0">
          <CardTitle className="flex flex-col items-start gap-0.5">
            <div className="text-lg font-semibold text-foreground leading-none">Feature Adoption</div>
            <div className="text-sm font-medium text-muted-foreground">Best adoption report</div>
          </CardTitle>
          <CardToolbar>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="dim" size="sm" mode="icon" className="-me-1.5">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem>
                  <Settings />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <TriangleAlert /> Export Report
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Pin /> Configure Alerts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Share2 /> Run Manual Check
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ShieldCheck /> View History
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Value */}
          <div className="text-5xl font-bold text-foreground">84%</div>

          {/* Bars */}
          <div className="flex items-end gap-2 w-full h-32 mt-2 relative">
            {bars.map((height, i) => (
              <div
                key={i}
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                className="flex flex-col justify-end flex-1 min-w-0 cursor-pointer transition-all"
              >
                {[...Array(maxBars)].map((_, j) => (
                  <div key={j} className={`h-3 my-0.5 rounded ${getBarColor(barInsights[i].direction, j, height)}`} />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

PreviewCode

>\_pnpm dlx shadcn@latest add @reui/statistic-card-15

RTL [Open in New Tab](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-15 "Open in New Tab") [Open in](https://v0.dev/chat/api/open?url=https://reui.io/r/statistic-card-15.json)

27.3%

NPS Improvement

Our new onboarding flow increased Net Promoter Score by 27.3% in Q2.

[Read full story](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-15#)

8,200

Active Users

Highest monthly active users since launch. Engagement up 12% MoM.

[See user insights](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-15#)

$1.4M

ARR Growth

Annual recurring revenue grew by $1.4M in the last quarter.

[View ARR breakdown](https://v1.reui.io/preview/cards/statistic-cards/statistic-card-15#)

ReUI

cards/statistic-cards/statistic-card-15.tsx

```
import Link from 'next/link';
import { Card, CardContent } from '@/registry/default/ui/card';
import { ArrowRight, ChartNoAxesCombined, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const cards = [\
  {\
    color: 'bg-blue-600',\
    icon: ChartNoAxesCombined,\
    value: '27.3%',\
    title: 'NPS Improvement',\
    desc: 'Our new onboarding flow increased Net Promoter Score by 27.3% in Q2.',\
    cta: 'Read full story',\
  },\
  {\
    color: 'bg-emerald-600',\
    icon: Users,\
    value: '8,200',\
    title: 'Active Users',\
    desc: 'Highest monthly active users since launch. Engagement up 12% MoM.',\
    cta: 'See user insights',\
  },\
  {\
    color: 'bg-fuchsia-700',\
    icon: TrendingUp,\
    value: '$1.4M',\
    title: 'ARR Growth',\
    desc: 'Annual recurring revenue grew by $1.4M in the last quarter.',\
    cta: 'View ARR breakdown',\
  },\
];

export default function StatisticCard15() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-8">
      <div className="@container grow w-full">
        <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-8 w-full">
          {cards.map((card, i) => (
            <Card key={i} className={cn('rounded-2xl overflow-hidden shadow-lg p-0 border-0', card.color)}>
              <CardContent className="relative overflow-hidden flex flex-col justify-end py-6 px-0 pb-0">
                {/* Icon */}
                <div className="px-6 mb-3.5">
                  <card.icon className="size-8 text-white/60" />
                </div>

                {/* Main content */}
                <div className="flex-1 flex flex-col justify-center items-start px-6">
                  <div className="text-white text-4xl font-bold mb-6">{card.value}</div>
                  <div className="text-white text-lg font-semibold mb-1">{card.title}</div>
                  <div className="text-white/80 text-sm mb-2">{card.desc}</div>
                </div>

                {/* Bottom bar */}
                <Link
                  href="#"
                  className="group/card w-full bg-black/90 dark:bg-zinc-800 px-6 py-4 flex items-center justify-between mt-6"
                >
                  <span className="text-white text-sm font-medium">{card.cta}</span>
                  <ArrowRight className="group-hover/card:translate-x-1 transition-transform duration-300 w-5 h-5 text-white" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Didn't find what you were looking for?

[Suggest block](https://github.com/keenthemes/reui/discussions/categories/suggestions)

©2026 ReUI. All rights reserved.

A project by [Keenthemes](https://keenthemes.com/)

[Hire Us](https://keenthemes.studio/)

ReUI
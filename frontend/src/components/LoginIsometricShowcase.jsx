import React from 'react'

// Exact 30-degree isometric projection helper
function iso(x, y, z = 0, cx = 230, cy = 112) {
  const px = cx + (x - y) * 0.866
  const py = cy + (x + y) * 0.5 - z
  return [Number(px.toFixed(1)), Number(py.toFixed(1))]
}

function pts(coords) {
  return coords.map(([x, y]) => `${x},${y}`).join(' ')
}

function IsoCube({
  x,
  y,
  z,
  dx,
  dy,
  dz,
  cx = 230,
  cy = 112,
  topFill = '#FFFFFF',
  leftFill = '#F1F5F9',
  rightFill = '#E2E8F0',
  stroke = '#CBD5E1',
  strokeWidth = 1.2
}) {
  const p000 = iso(x, y, z, cx, cy)
  const p100 = iso(x + dx, y, z, cx, cy)
  const p110 = iso(x + dx, y + dy, z, cx, cy)
  const p010 = iso(x, y + dy, z, cx, cy)

  const p001 = iso(x, y, z + dz, cx, cy)
  const p101 = iso(x + dx, y, z + dz, cx, cy)
  const p111 = iso(x + dx, y + dy, z + dz, cx, cy)
  const p011 = iso(x, y + dy, z + dz, cx, cy)

  return (
    <g stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round">
      {/* Top plane */}
      <polygon points={pts([p001, p101, p111, p011])} fill={topFill} />
      {/* Left plane (facing -x / +y front-left) */}
      <polygon points={pts([p010, p110, p111, p011])} fill={leftFill} />
      {/* Right plane (facing +x / front-right) */}
      <polygon points={pts([p100, p110, p111, p101])} fill={rightFill} />
      {/* Hidden back-top edges already covered; front vertical edge */}
      <line x1={p001[0]} y1={p001[1]} x2={p000[0]} y2={p000[1]} stroke="none" />
    </g>
  )
}

function MultiTenantScene() {
  const cx = 230
  const cy = 116
  const gridRange = [-90, -60, -30, 0, 30, 60, 90]

  const gwTop = iso(48, 48, 12, cx, cy)
  const t1Bot = iso(-62, -62, 16, cx, cy)
  const t2Bot = iso(-62, 12, 16, cx, cy)
  const t3Bot = iso(12, -62, 16, cx, cy)

  return (
    <svg
      viewBox="0 0 460 210"
      className="w-full h-auto select-none"
      role="img"
      aria-label="Ilustrasi Isometrik Multi-Tenant Cloud Architecture"
    >
      {/* Base Network Grid Plate */}
      <polygon
        points={pts([
          iso(-96, -96, 0, cx, cy),
          iso(96, -96, 0, cx, cy),
          iso(96, 96, 0, cx, cy),
          iso(-96, 96, 0, cx, cy)
        ])}
        fill="#F8FAFC"
        stroke="#CBD5E1"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {gridRange.map((g) => {
        const a1 = iso(g, -96, 0, cx, cy)
        const a2 = iso(g, 96, 0, cx, cy)
        const b1 = iso(-96, g, 0, cx, cy)
        const b2 = iso(96, g, 0, cx, cy)
        return (
          <g key={g} stroke="#E2E8F0" strokeWidth="0.9">
            <line x1={a1[0]} y1={a1[1]} x2={a2[0]} y2={a2[1]} />
            <line x1={b1[0]} y1={b1[1]} x2={b2[0]} y2={b2[1]} />
          </g>
        )
      })}

      {/* Emerald Data Pathways on Base Plate */}
      <g fill="none" stroke="#10B981" strokeWidth="1.4" strokeLinecap="round">
        <polyline
          points={pts([
            iso(-42, -42, 0, cx, cy),
            iso(48, -42, 0, cx, cy),
            iso(48, 48, 0, cx, cy)
          ])}
        />
        <polyline
          points={pts([
            iso(-42, 32, 0, cx, cy),
            iso(48, 32, 0, cx, cy),
            iso(48, 48, 0, cx, cy)
          ])}
        />
        <polyline
          points={pts([
            iso(32, -42, 0, cx, cy),
            iso(32, 48, 0, cx, cy),
            iso(48, 48, 0, cx, cy)
          ])}
        />
      </g>

      {/* Central Gateway Cube */}
      <IsoCube x={34} y={34} z={0} dx={30} dy={30} dz={14} cx={cx} cy={cy} />
      <circle cx={gwTop[0]} cy={gwTop[1] - 2} r="3" fill="#10B981" />
      <text
        x={gwTop[0] + 24}
        y={gwTop[1] + 18}
        className="fill-slate-500 font-mono text-[9px] font-semibold"
      >
        GATEWAY
      </text>

      {/* Floating Dedicated Tenant Cubes */}
      <g className="animate-iso-float">
        {/* Tenant 01 (Back) */}
        <IsoCube x={-78} y={-78} z={16} dx={36} dy={36} dz={34} cx={cx} cy={cy} />
        <circle cx={t1Bot[0]} cy={t1Bot[1] - 32} r="2.8" fill="#10B981" />
        <text
          x={t1Bot[0] - 24}
          y={t1Bot[1] - 48}
          className="fill-slate-600 font-mono text-[9px] font-semibold"
        >
          TENANT_01
        </text>

        {/* Tenant 02 (Left) */}
        <IsoCube x={-78} y={-4} z={16} dx={36} dy={36} dz={30} cx={cx} cy={cy} />
        <circle cx={t2Bot[0]} cy={t2Bot[1] - 28} r="2.8" fill="#10B981" />
        <text
          x={t2Bot[0] - 78}
          y={t2Bot[1] - 2}
          className="fill-slate-600 font-mono text-[9px] font-semibold"
        >
          TENANT_02
        </text>

        {/* Tenant 03 (Right) */}
        <IsoCube x={-4} y={-78} z={16} dx={36} dy={36} dz={30} cx={cx} cy={cy} />
        <circle cx={t3Bot[0]} cy={t3Bot[1] - 28} r="2.8" fill="#059669" />
        <text
          x={t3Bot[0] + 24}
          y={t3Bot[1] - 6}
          className="fill-slate-600 font-mono text-[9px] font-semibold"
        >
          TENANT_03
        </text>
      </g>
    </svg>
  )
}

function KernelSandboxScene() {
  const cx = 230
  const cy = 118
  const gridSteps = [-80, -40, 0, 40, 80]

  // Outer hexagonal boundary prism corners
  const hexTop = [
    iso(-64, -64, 62, cx, cy),
    iso(64, -64, 62, cx, cy),
    iso(64, 64, 62, cx, cy),
    iso(-64, 64, 62, cx, cy)
  ]
  const hexBot = [
    iso(-64, -64, 0, cx, cy),
    iso(64, -64, 0, cx, cy),
    iso(64, 64, 0, cx, cy),
    iso(-64, 64, 0, cx, cy)
  ]

  const limitStart = iso(64, -64, 62, cx, cy)
  const limitEnd = iso(64, -64, 0, cx, cy)

  return (
    <svg
      viewBox="0 0 460 210"
      className="w-full h-auto select-none"
      role="img"
      aria-label="Ilustrasi Isometrik Kernel Sandboxing & Cgroup V2"
    >
      {/* Coordinate Base Plate */}
      <polygon
        points={pts([
          iso(-96, -96, 0, cx, cy),
          iso(96, -96, 0, cx, cy),
          iso(96, 96, 0, cx, cy),
          iso(-96, 96, 0, cx, cy)
        ])}
        fill="#F8FAFC"
        stroke="#CBD5E1"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {gridSteps.map((g) => {
        const a1 = iso(g, -96, 0, cx, cy)
        const a2 = iso(g, 96, 0, cx, cy)
        const b1 = iso(-96, g, 0, cx, cy)
        const b2 = iso(96, g, 0, cx, cy)
        return (
          <g key={g} stroke="#E2E8F0" strokeWidth="0.9">
            <line x1={a1[0]} y1={a1[1]} x2={a2[0]} y2={a2[1]} />
            <line x1={b1[0]} y1={b1[1]} x2={b2[0]} y2={b2[1]} />
          </g>
        )
      })}

      {/* Inner Compute Container Cube */}
      <g className="animate-iso-float">
        <IsoCube x={-32} y={-32} z={8} dx={64} dy={64} dz={38} cx={cx} cy={cy} />
        {/* CPU Chip Seated on Top Face */}
        <IsoCube
          x={-16}
          y={-16}
          z={46}
          dx={32}
          dy={32}
          dz={8}
          cx={cx}
          cy={cy}
          topFill="#ECFDF5"
          leftFill="#D1FAE5"
          rightFill="#A7F3D0"
          stroke="#059669"
          strokeWidth="1.2"
        />
        {/* CPU Core Square */}
        <polygon
          points={pts([
            iso(-7, -7, 54, cx, cy),
            iso(7, -7, 54, cx, cy),
            iso(7, 7, 54, cx, cy),
            iso(-7, 7, 54, cx, cy)
          ])}
          fill="#10B981"
          stroke="#059669"
          strokeWidth="1"
        />
      </g>

      {/* Translucent Isometric Boundary Shield (Cgroup v2) */}
      <g stroke="#10B981" strokeWidth="1.2" strokeDasharray="4 3" strokeLinejoin="round">
        <polygon points={pts(hexTop)} fill="rgba(16, 185, 129, 0.05)" />
        <polygon points={pts([hexBot[3], hexBot[2], hexTop[2], hexTop[3]])} fill="rgba(16, 185, 129, 0.03)" />
        <polygon points={pts([hexBot[1], hexBot[2], hexTop[2], hexTop[1]])} fill="rgba(16, 185, 129, 0.04)" />
      </g>

      {/* Measurement Callout: 512 MB LIMIT */}
      <g>
        <line
          x1={limitStart[0] + 12}
          y1={limitStart[1]}
          x2={limitEnd[0] + 12}
          y2={limitEnd[1]}
          stroke="#059669"
          strokeWidth="1.2"
        />
        <circle cx={limitStart[0] + 12} cy={limitStart[1]} r="2.2" fill="#059669" />
        <circle cx={limitEnd[0] + 12} cy={limitEnd[1]} r="2.2" fill="#059669" />
        <text
          x={limitStart[0] + 20}
          y={(limitStart[1] + limitEnd[1]) / 2 + 3}
          className="fill-emerald-700 font-mono text-[9.5px] font-semibold"
        >
          512 MB LIMIT
        </text>
        <text
          x={hexBot[3][0] - 58}
          y={hexBot[3][1] - 4}
          className="fill-slate-500 font-mono text-[9px] font-semibold"
        >
          CGROUP V2
        </text>
      </g>
    </svg>
  )
}

function EdgeIngressScene() {
  const cx = 230
  const cy = 118

  const routerTop = iso(-72, 22, 28, cx, cy)
  const browserEntry = iso(-8, -10, 40, cx, cy)
  const desktopNode = iso(66, 48, 12, cx, cy)
  const mobileNode = iso(72, -36, 12, cx, cy)

  // Tilted 2.5D Browser Frame Corners (upright isometric plane facing viewer)
  const b0 = iso(-24, -42, 18, cx, cy)
  const b1 = iso(38, -42, 18, cx, cy)
  const b2 = iso(38, -42, 74, cx, cy)
  const b3 = iso(-24, -42, 74, cx, cy)

  const url0 = iso(-18, -42, 58, cx, cy)
  const url1 = iso(32, -42, 58, cx, cy)
  const url2 = iso(32, -42, 66, cx, cy)
  const url3 = iso(-18, -42, 66, cx, cy)

  const card0 = iso(-18, -42, 26, cx, cy)
  const card1 = iso(32, -42, 26, cx, cy)
  const card2 = iso(32, -42, 50, cx, cy)
  const card3 = iso(-18, -42, 50, cx, cy)

  return (
    <svg
      viewBox="0 0 460 210"
      className="w-full h-auto select-none"
      role="img"
      aria-label="Ilustrasi Isometrik Edge Ingress & Publikasi Web"
    >
      {/* Base Network Plate */}
      <polygon
        points={pts([
          iso(-100, -84, 0, cx, cy),
          iso(100, -84, 0, cx, cy),
          iso(100, 84, 0, cx, cy),
          iso(-100, 84, 0, cx, cy)
        ])}
        fill="#F8FAFC"
        stroke="#CBD5E1"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Ingress Data Paths */}
      <g fill="none" stroke="#10B981" strokeWidth="1.4" strokeLinecap="round">
        <polyline
          points={pts([
            iso(-52, 22, 14, cx, cy),
            iso(-8, 22, 14, cx, cy),
            iso(-8, -10, 14, cx, cy)
          ])}
        />
        <polyline
          points={pts([
            iso(38, -24, 14, cx, cy),
            iso(66, -24, 14, cx, cy),
            iso(66, 48, 14, cx, cy)
          ])}
        />
        <polyline
          points={pts([
            iso(38, -36, 14, cx, cy),
            iso(72, -36, 14, cx, cy)
          ])}
        />
      </g>

      {/* Edge Ingress Router Cube */}
      <IsoCube x={-90} y={4} z={0} dx={36} dy={36} dz={24} cx={cx} cy={cy} />
      <circle cx={routerTop[0]} cy={routerTop[1] - 4} r="3" fill="#10B981" />
      <text
        x={routerTop[0] - 42}
        y={routerTop[1] + 44}
        className="fill-slate-600 font-mono text-[9px] font-semibold"
      >
        EDGE INGRESS
      </text>

      {/* Floating 2.5D Isometric Browser Window */}
      <g className="animate-iso-float">
        {/* Subtle back thickness plane */}
        <polygon
          points={pts([
            iso(-24, -46, 18, cx, cy),
            iso(38, -46, 18, cx, cy),
            iso(38, -46, 74, cx, cy),
            iso(-24, -46, 74, cx, cy)
          ])}
          fill="#E2E8F0"
          stroke="#CBD5E1"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Main Browser Face */}
        <polygon
          points={pts([b0, b1, b2, b3])}
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Address Bar */}
        <polygon
          points={pts([url0, url1, url2, url3])}
          fill="#F1F5F9"
          stroke="#CBD5E1"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* SSL Lock Dot */}
        <circle cx={url3[0] + 6} cy={url3[1] + 5} r="2.2" fill="#059669" />
        {/* Wireframe Content Area */}
        <polygon
          points={pts([card0, card1, card2, card3])}
          fill="#F8FAFC"
          stroke="#E2E8F0"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <text
          x={b3[0] - 4}
          y={b3[1] - 8}
          className="fill-emerald-700 font-mono text-[9px] font-semibold"
        >
          *.miraigrid.web.id (SSL)
        </text>
      </g>

      {/* Endpoint Tiles: Desktop & Mobile */}
      <IsoCube x={52} y={34} z={0} dx={28} dy={28} dz={12} cx={cx} cy={cy} />
      <circle cx={desktopNode[0]} cy={desktopNode[1]} r="2.4" fill="#10B981" />
      <text
        x={desktopNode[0] + 18}
        y={desktopNode[1] + 18}
        className="fill-slate-500 font-mono text-[8.5px] font-semibold"
      >
        DESKTOP
      </text>

      <IsoCube x={60} y={-48} z={0} dx={22} dy={22} dz={14} cx={cx} cy={cy} />
      <circle cx={mobileNode[0]} cy={mobileNode[1]} r="2.4" fill="#059669" />
      <text
        x={mobileNode[0] + 18}
        y={mobileNode[1] + 6}
        className="fill-slate-500 font-mono text-[8.5px] font-semibold"
      >
        MOBILE
      </text>
    </svg>
  )
}

export default function LoginIsometricShowcase({ activeStep }) {
  return (
    <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl px-4 py-3 overflow-hidden">
      <div key={activeStep} className="transition-opacity duration-300 animate-showcase-step">
        {activeStep === 0 && <MultiTenantScene />}
        {activeStep === 1 && <KernelSandboxScene />}
        {activeStep === 2 && <EdgeIngressScene />}
      </div>
    </div>
  )
}

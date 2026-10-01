const P = {
  play: 'M7 4.5v15l13-7.5z',
  stop: 'M6 6h12v12H6z',
  pause: 'M6.5 5h4v14h-4zM13.5 5h4v14h-4z',
  rew: 'M11 6v12l-8-6zM20 6v12l-8-6z',
  fwd: 'M4 6v12l8-6zM13 6v12l8-6z',
  prev: 'M6 5h2.5v14H6zM19 5v14L9 12z',
  next: 'M15.5 5H18v14h-2.5zM5 5v14l10-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  voice: 'M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  text: 'M5 6h14M5 12h14M5 18h9',
  stage: 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
  download: 'M12 3v12M8 11l4 4 4-4M5 20h14',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  close: 'M6 6l12 12M18 6L6 18',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  metro: 'M9 3h6l4 18H5zM12 17l5-10',
  wave: 'M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2',
}

export function Icon({ name, size = 22, fill = false, title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title && <title>{title}</title>}
      <path d={P[name]} />
    </svg>
  )
}
